// =========================================================
// CLOUDFLARE SERVICE — DNS SRV + CNAME y túnel cloudflared
// ---------------------------------------------------------
// Permite exponer instancias de Minecraft detrás de un
// subdominio amigable (ej. <sub>.quesitohosting.shop) sin que
// el jugador tenga que escribir el puerto:
//
//   _minecraft._tcp.<sub>.<domain>  SRV  ->  <sub>.<domain> : <allocated_port>
//   <sub>.<domain>                 CNAME ->  <tunnel-uuid>.cfargotunnel.com
//
// Como el host normalmente NO tiene IP pública, el tráfico TCP
// llega por un túnel cloudflared saliente. El target del SRV
// resuelve al hostname público del túnel (CNAME proxied).
//
// Decisión por defecto (según CLOUDFLARE_TUNNEL_LOCAL_DOMAIN):
//  - Si el túnel gestiona el wildcard localmente, solo se crean
//    registros DNS (CNAME + SRV).
//  - En caso contrario, además se reescribe config.yml del túnel
//    con un ingress tcp://localhost:<puerto> y se recarga el túnel.
// =========================================================

import { execSync } from 'child_process'
import axios, { type AxiosInstance } from 'axios'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { MC_CONFIG } from '../config/minecraft'

// La API de Cloudflare devuelve errores con detalle en data.errors
interface CfErrorBody {
  success: boolean
  errors?: Array<{ code: number; message: string }>
  messages?: Array<{ code: number; message: string }>
}

class CloudflareServiceClass {
  private client: AxiosInstance | null = null

  // ── Preparación de la API ──────────────────────────────
  private api() {
    if (!MC_CONFIG.cfToken || !MC_CONFIG.cfZoneId) {
      throw new Error(
        'Cloudflare no está configurado: define CLOUDFLARE_API_TOKEN y CLOUDFLARE_ZONE_ID',
      )
    }
    if (!this.client) {
      this.client = axios.create({
        baseURL: 'https://api.cloudflare.com/client/v4',
        headers: {
          Authorization: `Bearer ${MC_CONFIG.cfToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      })
    }
    return this.client
  }

  // ── Target del registro (túnel o IP de respaldo) ───────
  // Devuelve el valor al que debe apuntar el CNAME/SRV.
  // Prioridad: túnel cloudflared > PUBLIC_IP.
  async resolveTarget(): Promise<{ cnameTarget: string; srvTarget: string; viaTunnel: boolean }> {
    const tunnelHost = await this.getTunnelPublicHost()
    if (tunnelHost) {
      return {
        cnameTarget: tunnelHost,       // <uuid>.cfargotunnel.com
        srvTarget:   tunnelHost,
        viaTunnel:   true,
      }
    }
    if (MC_CONFIG.publicIp) {
      return {
        cnameTarget: MC_CONFIG.publicIp,
        srvTarget:   MC_CONFIG.publicIp,
        viaTunnel:   false,
      }
    }
    throw new Error(
      'Sin IP pública y sin túnel configurado: define CLOUDFLARE_TUNNEL o PUBLIC_IP',
    )
  }

  // ── Publicar CNAME + SRV ───────────────────────────────
  async ensureDns(subdomain: string, allocatedPort: number): Promise<{
    fqdn: string
    srv: string
    connection: string
    viaTunnel: boolean
  }> {
    const api = this.api()
    const domain = MC_CONFIG.domain
    const fqdn = `${subdomain}.${domain}`

    const { cnameTarget, viaTunnel } = await this.resolveTarget()

    // 1) CNAME: <sub>.<domain> -> target (proxied al túnel / IP)
    await this.upsertRecord({
      type: 'CNAME',
      name: fqdn,
      content: cnameTarget,
      proxied: viaTunnel, // solo proxied si hay túnel; una IP directa no se proxya
    })

    // 2) SRV: _minecraft._tcp.<sub>.<domain> -> target : allocatedPort
    // Cloudflare guarda el SRV con service/proto separados.
    await this.upsertRecord({
      type: 'SRV',
      name: fqdn, // Cloudflare antepone _service._proto al crear el FQDN
      data: {
        service: '_minecraft',
        proto: '_tcp',
        name: fqdn,
        priority: 0,
        weight: 5,
        port: allocatedPort,
        target: cnameTarget,
      },
    })

    return {
      fqdn,
      srv: `_minecraft._tcp.${fqdn}`,
      // IP final de conexión que ve el jugador (Minecraft aplica SRV)
      connection: `${fqdn}:${allocatedPort}`,
      viaTunnel,
    }
  }

  // ── Public Hostname TCP del túnel (API Zero Trust) ────
  // cloudflared en modo --token (remotamente managed) ignora config.yml
  // local. El enrutamiento del tráfico TCP (por hostname) se define en la
  // config remota del túnel, vía la API de Zero Trust:
  //   /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations
  // Este método fusiona las reglas de todos los subdominios del panel en la
  // config remota, de modo que <fqdn> enrute a tcp://localhost:<puerto>.
  async ensureTunnelPublicHostname(
    entries: Array<{ fqdn: string; port: number }>,
  ): Promise<void> {
    const api = this.api()
    const accountId = MC_CONFIG.cfAccountId
    const tunnel = MC_CONFIG.cfTunnel
    if (!accountId) {
      throw new Error(
        'CLOUDFLARE_ACCOUNT_ID no está definido: no se puede configurar el Public Hostname TCP del túnel',
      )
    }
    if (!tunnel) {
      throw new Error('CLOUDFLARE_TUNNEL no está definido (túnel cloudflared)')
    }

    const base = `/accounts/${accountId}/cfd_tunnel/${tunnel}/configurations`

    // 1) Config actual del túnel
    let remote: {
      config?: {
        ingress?: Array<{ hostname?: string; service: string; [k: string]: unknown }>
        [k: string]: unknown
      }
      [k: string]: unknown
    } = {}
    try {
      const get = await api.get(base)
      remote = get.data?.result ?? {}
    } catch (err: any) {
      // Si el token no tiene acceso al túnel, fallará aquí de forma clara.
      throw new Error(
        `No se pudo leer la configuración del túnel (${tunnel}). Revisa que CLOUDFLARE_ACCOUNT_ID y el token tengan permiso de Cloudflare Tunnel: ${err?.message || err}`,
      )
    }

    const currentIngress = remote.config?.ingress ?? []
    const managedHostnames = new Set(entries.map((e) => e.fqdn))

    // 2) Fusiona: conserva reglas de hostnames ajenos, reemplaza las nuestras
    const kept = currentIngress.filter((r) => !(r.hostname && managedHostnames.has(r.hostname)))
    const ours = entries.map((e) => ({
      hostname: e.fqdn,
      service: `tcp://localhost:${e.port}`,
    }))

    // La config remota siempre tiene una regla final catch-all; la
    // conservamos tal cual y aseguramos que exista una al final.
    const hasCatchAll = kept.some((r) => !r.hostname)
    const ingress = [...kept, ...ours]
    if (!hasCatchAll) ingress.push({ service: 'http_status:404' })

    // 3) PUT con la config fusionada.
    // IMPORTANTE: Cloudflare devuelve la config con claves guionadas
    // (ej. "warp-routing"), pero la API de escritura rechaza (400) si se
    // reenvían así. Se normalizan las claves a guion bajo y se fuerza
    // warp_routing para no romper la config existente.
    const cleanConfig: Record<string, unknown> = {}
    if (remote.config) {
      for (const [k, v] of Object.entries(remote.config)) {
        cleanConfig[k.replace(/-/g, '_')] = v
      }
    }
    if (!cleanConfig['warp_routing']) cleanConfig['warp_routing'] = { enabled: true }

    await api.put(base, {
      config: {
        ...cleanConfig,
        ingress,
      },
    })
  }

  // ── Recarga del túnel cloudflared ─────────────────────
  // Reescribe config.yml añadiendo/afianzando ingress TCP por hostname.
  // IMPORTA: se invoca con el conjunto completo de ingress de todas las
  // instancias con dominio, no solo con una, para no borrar los demás.
  writeIngressConfig(entries: Array<{ fqdn: string; port: number }>): void {
    const cfgPath = MC_CONFIG.cfTunnelConfig
    const tunnel = MC_CONFIG.cfTunnel
    if (!tunnel) {
      throw new Error('CLOUDFLARE_TUNNEL no está definido (túnel cloudflared)')
    }

    // Lee la config existente (o usa plantilla mínima)
    const existing = fs.existsSync(cfgPath)
      ? safeYamlLoad(cfgPath)
      : { tunnel }

    // Última regla obligatoria: responder a todo lo demás con HTTP 404
    const ingress: Array<{ hostname?: string; service: string }> = entries.map((e) => ({
      hostname: e.fqdn,
      service: `tcp://127.0.0.1:${e.port}`,
    }))
    ingress.push({ service: 'http_status:404' })

    const yml = serializeYaml({
      tunnel: existing.tunnel || tunnel,
      'credentials-file': existing['credentials-file'] || existCredentials(tunnel),
      ingress,
    })

    fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
    fs.writeFileSync(cfgPath, yml, 'utf8')

    // Recarga del túnel: siempre best-effort (no debe tumbar el request
    // si systemd/cloudflared no está disponible en este host).
    try {
      execSync(
        'systemctl reload-or-restart cloudflared 2>/dev/null || cloudflared tunnel ingress validate',
        { stdio: 'ignore', timeout: 30_000 },
      )
    } catch {
      /* sin systemd ni cloudflared en el host: config quedó escrita */
    }
  }

  // ── Helpers privados ───────────────────────────────────

  // Hostname público del túnel configurado (<uuid>.cfargotunnel.com)
  private async getTunnelPublicHost(): Promise<string | null> {
    if (!MC_CONFIG.cfTunnel) return null

    try {
      // cloudflared tunnel list -> UUID
      const out = execSync('cloudflared tunnel list 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 20_000,
      })
      const line = out.split('\n').find((l) => l.includes(MC_CONFIG.cfTunnel))
      const m = line ? line.match(/([0-9a-f]{8}-[0-9a-f-]{27,36})/) : null
      const uuid = m ? m[1] : MC_CONFIG.cfTunnel
      return `${uuid}.cfargotunnel.com`
    } catch {
      // cloudflared no disponible: asumimos que CLOUDFLARE_TUNNEL es ya el UUID
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/.test(MC_CONFIG.cfTunnel)) {
        return `${MC_CONFIG.cfTunnel}.cfargotunnel.com`
      }
      return null
    }
  }

  // Upsert idempotente: busca el registro por tipo+nombre y lo actualiza,
  // o lo crea si no existe.
  private async upsertRecord(body: {
    type: string
    name: string
    content?: string
    data?: Record<string, unknown>
    proxied?: boolean
  }): Promise<void> {
    const api = this.api()
    const zone = MC_CONFIG.cfZoneId

    const list = await api.get('/zones/' + zone + '/dns_records', {
      params: { type: body.type, name: body.name },
    })

    const existing = list.data.result?.[0]
    const payload: Record<string, unknown> = {
      type: body.type,
      name: body.name,
      ttl: 1, // 1 = automático (Cloudflare)
    }
    // Los registros SRV no se pueden proxear por la nube naranja; solo DNS.
    if (body.type !== 'SRV') payload.proxied = body.proxied ?? false
    if (body.content !== undefined) payload.content = body.content
    if (body.data !== undefined) payload.data = body.data

    if (existing) {
      await api.put(`/zones/${zone}/dns_records/${existing.id}`, payload)
    } else {
      await api.post(`/zones/${zone}/dns_records`, payload)
    }
  }
}

// ── Mini-serializador/serializador YAML muy acotado ──────
const safeYamlLoad = (file: string): Record<string, unknown> => {
  // Lectura básica de claves de primer nivel + ingress (solo para fusión)
  const raw = fs.readFileSync(file, 'utf8')
  const out: Record<string, unknown> = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (m && !line.startsWith(' ')) {
      out[m[1]] = unquote(m[2])
    }
  }
  return out
}

const existCredentials = (tunnel: string): string =>
  path.join(os.homedir(), '.cloudflared', `${tunnel}.json`)

const serializeYaml = (obj: Record<string, unknown>): string => {
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'ingress') continue
    lines.push(`${k}: ${typeof v === 'string' ? `"${String(v).replace(/"/g, '\\"')}"` : String(v)}`)
  }
  lines.push('ingress:')
  const ingress = obj.ingress as Array<Record<string, unknown>> | undefined
  if (Array.isArray(ingress) && ingress.length > 0) {
    for (const r of ingress) {
      lines.push(`  - hostname: "${String(r.hostname)}"`)
      lines.push(`    service: "${String(r.service)}"`)
    }
  } else {
    lines.push('  - service: http_status:404')
  }
  return lines.join('\n') + '\n'
}

const unquote = (s: string): string =>
  s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s

// Función de utilidad para normalizar un prefijo de subdominio
export function normalizeSubdomain(input: string): string {
  const clean = (input || '')
    .toLowerCase()
    .replace(/\.\w+\.\w+$/, '')   // si pasaron el FQDN completo, queda el prefijo
    .replace(/^www\./, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean.slice(0, 63) // límite de etiqueta DNS
}

export const cloudflareService = new CloudflareServiceClass()
