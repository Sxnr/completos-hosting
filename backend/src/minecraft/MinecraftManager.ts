// =========================================================
// MINECRAFT MANAGER — Singleton que gestiona todas las
// instancias. Punto de entrada para el resto del backend.
// =========================================================

import path from 'path'
import fs   from 'fs'
import axios from 'axios'
import { execSync } from 'child_process'
import type { Pool } from 'pg'
import { MinecraftInstance, type InstanceStatus } from './MinecraftInstance'
import { MC_CONFIG } from '../config/minecraft'
import { playitManager } from '../services/PlayitManager'
import { cloudflareService, normalizeSubdomain } from '../services/cloudflare'

// Fill v3 (PaperMC) exige un User-Agent identificable
const PAPER_UA = 'CompletosHosting/0.2 (https://quesitohosting.shop)'

interface InstanceRow {
  id:            number
  name:          string
  description:   string | null
  software:      string
  version:       string
  edition:       string
  port:          number
  allocated_port: number | null
  subdomain:     string | null
  dns_created:   boolean
  last_status:   string
  ram_mb:        number
  java_flags:    string
  folder_name:   string
  properties:    Record<string, unknown>
  created_at:    string
  updated_at:    string
  tunnel_address?: string
}

export class MinecraftManager {
  private db:               Pool
  private instances:        Map<number, MinecraftInstance> = new Map()
  private downloadProgress: Map<string, {
    percent: number
    status:  'downloading' | 'done' | 'error'
    message: string
  }> = new Map()

  constructor(db: Pool) {
    this.db = db
  }

  // ── Inicializar ───────────────────────────────────────
  async init(): Promise<void> {
    fs.mkdirSync(MC_CONFIG.serversDir, { recursive: true })
    fs.mkdirSync(MC_CONFIG.jarsDir,    { recursive: true })

    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances ORDER BY id ASC'
    )

    for (const row of rows) {
      const instance = new MinecraftInstance(row.id, row.folder_name)
      this.instances.set(row.id, instance)
      // Restaurar túnel en memoria si existe en DB
      if (row.tunnel_address) {
        playitManager.setTunnel(row.id, row.tunnel_address)
      }
    }

    console.log(`✅ MinecraftManager: ${rows.length} instancias cargadas`)
  }

  // ── CRUD ──────────────────────────────────────────────

  async createInstance(opts: {
    name:         string
    description?: string
    software:     string
    version:      string
    edition:      string
    port?:        number
    ramMb?:       number
    createdBy?:   number
  }): Promise<InstanceRow & { tunnel_address: string }> {
    const folderName = opts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now()

    // Puerto de red: usa el solicitado si se dio, o asigna el primero libre
    // escaneando los puertos TCP realmente en uso del host + los de la DB.
    const allocated = opts.port || await this._nextAvailablePort()
    const port = allocated

    const properties = {
      ...MC_CONFIG.defaultProperties,
      'server-port': port,
    }

    // Crear túnel playit para este puerto
    const tunnelAddress = await playitManager.createTunnel(
      -1, // ID temporal, se actualiza después
      port
    )

    const { rows } = await this.db.query<InstanceRow>(
      `INSERT INTO minecraft_instances
        (name, description, software, version, edition, port, allocated_port, ram_mb, folder_name, properties, created_by, tunnel_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        opts.name,
        opts.description || null,
        opts.software,
        opts.version,
        opts.edition,
        port,
        allocated,
        opts.ramMb || 1024,
        folderName,
        JSON.stringify(properties),
        opts.createdBy || null,
        tunnelAddress,
      ]
    )

    const row = rows[0]

    // Actualizar el túnel con el ID real
    playitManager.setTunnel(row.id, tunnelAddress)

    const instanceDir = path.join(MC_CONFIG.serversDir, folderName)
    fs.mkdirSync(instanceDir, { recursive: true })
    this._writeServerProperties(instanceDir, properties)

    const instance = new MinecraftInstance(row.id, folderName)
    this.instances.set(row.id, instance)

    return { ...row, tunnel_address: tunnelAddress }
  }

  // ── Red y Dominio ─────────────────────────────────────

  // Datos de red de una instancia ya configurada
  async getNetworkInfo(id: number): Promise<{
    allocated_port: number
    subdomain: string | null
    dns_created: boolean
    fqdn: string | null
    srv: string | null
    connection: string | null
  } | null> {
    const row = await this.getInstance(id)
    if (!row) return null

    const base = MC_CONFIG.domain
    const fqdn = row.subdomain ? `${row.subdomain}.${base}` : null
    const port = row.allocated_port ?? row.port
    return {
      allocated_port: port,
      subdomain: row.subdomain,
      dns_created: row.dns_created,
      fqdn,
      srv: fqdn ? `_minecraft._tcp.${fqdn}` : null,
      connection: fqdn ? `${fqdn}:${port}` : null,
    }
  }

  // Publica el subdominio + DNS (CNAME/SRV) + ingress del túnel para la
  // instancia. Valida que el subdominio no esté tomado por OTRA instancia.
  // Devuelve la info de conexión actualizada.
  async provisionNetwork(
    id: number,
    subdomainInput: string,
  ): Promise<NonNullable<Awaited<ReturnType<MinecraftManager['getNetworkInfo']>>>> {
    const row = await this.getInstance(id)
    if (!row) throw new Error(`Instancia ${id} no encontrada`)

    const subdomain = normalizeSubdomain(subdomainInput)
    if (!subdomain) {
      throw Object.assign(new Error('Subdominio inválido'), { code: 'INVALID_SUBDOMAIN' })
    }

    // Validación de unicidad: ¿alguien más usa este subdominio?
    const taken = await this.db.query<{ id: number }>(
      'SELECT id FROM minecraft_instances WHERE subdomain = $1 AND id <> $2',
      [subdomain, id],
    )
    if (taken.rows[0]) {
      throw Object.assign(
        new Error(`El subdominio "${subdomain}" ya está en uso por otra instancia`),
        { code: 'SUBDOMAIN_TAKEN' },
      )
    }

    // Puerto de red de esta instancia
    const allocatedPort = row.allocated_port ?? row.port

    // 1) Registros DNS en Cloudflare
    const dns = await cloudflareService.ensureDns(subdomain, allocatedPort)

    // 2) Ingress del túnel (solo si el tráfico sale por el túnel y este
    //    NO gestiona localmente el wildcard del dominio)
    const viaTunnel = dns.viaTunnel
      && !MC_CONFIG.cfTunnelLocalDomain
    if (viaTunnel) {
      const all = await this.getAllProvisioned(id, subdomain, allocatedPort)
      cloudflareService.writeIngressConfig(all)
    }

    // 3) Persistir en DB
    await this.db.query(
      `UPDATE minecraft_instances
          SET subdomain = $1,
              allocated_port = $2,
              dns_created = true
        WHERE id = $3`,
      [subdomain, allocatedPort, id],
    )

    // 4) Garantiza que server.properties escuche en el puerto asignado
    try {
      const propsPath = path.join(MC_CONFIG.serversDir, row.folder_name, 'server.properties')
      let props = fs.readFileSync(propsPath, 'utf8')
      props = props.replace(/^server-port=.*$/m, `server-port=${allocatedPort}`)
      fs.writeFileSync(propsPath, props, 'utf8')
    } catch {
      // si aún no existe el archivo, se genera al iniciar desde `properties`
    }

    return {
      allocated_port: allocatedPort,
      subdomain,
      dns_created: true,
      fqdn: dns.fqdn,
      srv: dns.srv,
      connection: dns.connection,
    }
  }

  // Lista de ingress para reconstruir config.yml (todas las instancias
  // con subdomain, más la que se está creando en este momento).
  private async getAllProvisioned(
    currentId: number,
    currentSub: string,
    currentPort: number,
  ): Promise<Array<{ fqdn: string; port: number }>> {
    const { rows } = await this.db.query<{
      id:            number
      subdomain:     string
      allocated_port: number | null
      dns_created:   boolean
    }>(
      `SELECT id, subdomain, allocated_port, dns_created
         FROM minecraft_instances
        WHERE dns_created = true AND subdomain IS NOT NULL`,
    )
    const entries = rows.map(r => ({
      fqdn: `${r.subdomain}.${MC_CONFIG.domain}`,
      port: r.allocated_port ?? 0,
    }))
    entries.push({ fqdn: `${currentSub}.${MC_CONFIG.domain}`, port: currentPort })
    // Evita duplicados por si esta instancia ya estaba en DB
    return Array.from(
      new Map(entries.map(e => [e.fqdn, e])).values(),
    )
  }

  async deleteInstance(id: number): Promise<void> {
    const instance = this.instances.get(id)
    if (instance?.isRunning) await instance.stop()

    const { rows } = await this.db.query<{ folder_name: string }>(
      'SELECT folder_name FROM minecraft_instances WHERE id = $1',
      [id]
    )

    if (rows[0]) {
      const folderPath = path.join(MC_CONFIG.serversDir, rows[0].folder_name)
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true })
      }
    }

    await this.db.query('DELETE FROM minecraft_instances WHERE id = $1', [id])
    this.instances.delete(id)
    playitManager.removeTunnel(id)
  }

  async getInstance(id: number): Promise<InstanceRow | null> {
    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances WHERE id = $1',
      [id]
    )
    return rows[0] || null
  }

  async listInstances(): Promise<(InstanceRow & {
    status:          InstanceStatus
    playerCount:     number
    players:         string[]
    tunnel_address:  string
    fqdn:            string | null
    network_address: string
  })[]> {
    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances ORDER BY created_at DESC'
    )

    return rows.map(row => {
      const instance = this.instances.get(row.id)
      const fqdn = row.subdomain && row.dns_created
        ? `${row.subdomain}.${MC_CONFIG.domain}`
        : null
      const tunnelAddress =
        playitManager.getTunnel(row.id) ??
        row.tunnel_address ??
        `172.22.165.77:${row.port}`
      return {
        ...row,
        status:          instance?.status      || 'offline',
        playerCount:     instance?.playerCount || 0,
        players:         instance?.players     || [],
        tunnel_address:  tunnelAddress,
        fqdn,
        // Dirección preferida para mostrar: el dominio cuando está
        // publicado (dns_created), de lo contrario el túnel playit/fallback.
        network_address: fqdn ?? tunnelAddress,
      }
    })
  }

  // ── Start / Stop / Restart ────────────────────────────

  async startInstance(id: number): Promise<void> {
    const instance = this.getInstance_mem(id)
    const row      = await this.getInstance(id)
    if (!row) throw new Error(`Instancia ${id} no encontrada`)

    // Límite de instancias simultáneas corriendo
    const running = [...this.instances.values()].filter(i => i.isRunning).length
    if (running >= MC_CONFIG.maxRunningInstances) {
      throw new Error(
        `Límite alcanzado: máximo ${MC_CONFIG.maxRunningInstances} instancias corriendo a la vez`,
      )
    }

    const jarInInstance = path.join(MC_CONFIG.serversDir, row.folder_name, 'server.jar')
    const jarInCache    = path.join(MC_CONFIG.jarsDir, row.software, `${row.version}.jar`)

    let jarFile: string

    if (fs.existsSync(jarInInstance)) {
      jarFile = jarInInstance
    } else if (fs.existsSync(jarInCache)) {
      fs.copyFileSync(jarInCache, jarInInstance)
      jarFile = jarInInstance
    } else {
      this.downloadJar(row.software, row.version)
        .catch(err => console.error(`Error descargando JAR: ${err.message}`))

      throw Object.assign(
        new Error(`JAR no encontrado. Descargando ${row.software} ${row.version}...`),
        { code: 'JAR_DOWNLOADING' }
      )
    }

    await instance.start({
      jarFile,
      ramMb:     row.ram_mb,
      javaFlags: row.java_flags || '',
    })

    await this.db.query(
      "UPDATE minecraft_instances SET last_status = 'online' WHERE id = $1",
      [id]
    )
  }

  async stopInstance(id: number): Promise<void> {
    const instance = this.getInstance_mem(id)
    await instance.stop()
    await this.db.query(
      "UPDATE minecraft_instances SET last_status = 'offline' WHERE id = $1",
      [id]
    )
  }

  async restartInstance(id: number): Promise<void> {
    await this.stopInstance(id)
    await this.startInstance(id)
  }

  // ── Acceso en memoria ─────────────────────────────────

  getInstance_mem(id: number): MinecraftInstance {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Instancia ${id} no encontrada en memoria`)
    return instance
  }

  // ── Progreso de descarga ──────────────────────────────

  getDownloadProgress(software: string, version: string) {
    return this.downloadProgress.get(`${software}-${version}`) ?? null
  }

  // ── Descarga de JARs ──────────────────────────────────

  async downloadJar(software: string, version: string): Promise<string> {
    const key      = `${software}-${version}`
    const destDir  = path.join(MC_CONFIG.jarsDir, software)
    const destPath = path.join(destDir, `${version}.jar`)

    if (fs.existsSync(destPath)) {
      this.downloadProgress.set(key, { percent: 100, status: 'done', message: 'JAR ya disponible en caché' })
      return destPath
    }

    fs.mkdirSync(destDir, { recursive: true })
    this.downloadProgress.set(key, { percent: 0, status: 'downloading', message: 'Obteniendo URL de descarga...' })

    try {
      const url = await this._getDownloadUrl(software, version)
      this.downloadProgress.set(key, { percent: 5, status: 'downloading', message: `Descargando ${software} ${version}...` })

      const response = await axios.get(url, {
        responseType: 'stream',
        timeout:      180_000,
        headers:      { 'User-Agent': PAPER_UA },
      })

      const totalLength = parseInt(response.headers['content-length'] ?? '0', 10)
      let downloaded = 0

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(destPath)

        response.data.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (totalLength > 0) {
            const percent = Math.round((downloaded / totalLength) * 95) + 5
            this.downloadProgress.set(key, {
              percent,
              status:  'downloading',
              message: `Descargando... ${formatBytes(downloaded)} / ${formatBytes(totalLength)}`,
            })
          }
        })

        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error',  reject)
      })

      this.downloadProgress.set(key, { percent: 100, status: 'done', message: '¡JAR descargado correctamente!' })
      return destPath

    } catch (err: any) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
      this.downloadProgress.set(key, { percent: 0, status: 'error', message: err.message })
      throw err
    }
  }

  // ── Privados ──────────────────────────────────────────

  // Devuelve el primer puerto TCP libre desde MC_CONFIG.basePort.
  // Combina: (1) los puertos reservados en la DB, (2) los puertos
  // realmente en uso/escucha en el host (via /proc/net/tcp) para no
  // chocar con servicios que no estén registrados en el panel.
  private async _nextAvailablePort(): Promise<number> {
    const reserved = await this._dbReservedPorts()
    const listening = this._hostListeningPorts()
    const base = MC_CONFIG.basePort
    const limit = base + MC_CONFIG.portScanLimit

    for (let p = base; p < limit; p++) {
      if (reserved.has(p) || listening.has(p)) continue
      return p
    }
    throw new Error(
      `No se encontró un puerto libre entre ${base} y ${limit}`,
    )
  }

  private async _dbReservedPorts(): Promise<Set<number>> {
    const { rows } = await this.db.query<{ allocated_port: number | null }>(
      'SELECT allocated_port FROM minecraft_instances',
    )
    const set = new Set<number>()
    for (const r of rows) {
      if (r.allocated_port != null) set.add(r.allocated_port)
    }
    return set
  }

  // Lee /proc/net/tcp (y tcp6) para obtener los puertos en estado
  // LISTEN (0A) del namespace de red. Devuelve el puerto local decimal.
  private _hostListeningPorts(): Set<number> {
    const set = new Set<number>()
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      try {
        const content = fs.readFileSync(file, 'utf8')
        for (const line of content.split('\n').slice(1)) {
          const parts = line.trim().split(/\s+/)
          if (parts.length < 4) continue
          const state = parts[3]
          if (state !== '0A') continue // solo LISTEN
          const local = parts[1]       // "ADDR:HEXPORT"
          const hexPort = local.split(':').pop()
          if (!hexPort) continue
          const port = parseInt(hexPort, 16)
          if (!Number.isNaN(port)) set.add(port)
        }
      } catch {
        // /proc no disponible (no-Linux o restricciones); fallback a netstat
        try {
          const out = execSync(
            'netstat -tln 2>/dev/null || ss -tln 2>/dev/null',
            { encoding: 'utf-8', timeout: 10_000 },
          )
          for (const line of out.split('\n')) {
            const m = line.match(/:(\d+)\s+\S+\s+LISTEN/)
            if (m) set.add(parseInt(m[1], 10))
          }
        } catch {
          /* sin datos de red: confiamos solo en la DB */
        }
      }
    }
    return set
  }

  private _writeServerProperties(dir: string, props: Record<string, unknown>): void {
    const lines = [
      '#Minecraft server properties',
      '#Generated by ServerOS Dashboard',
      '',
      ...Object.entries(props).map(([k, v]) => `${k}=${v}`),
    ]
    fs.writeFileSync(path.join(dir, 'server.properties'), lines.join('\n'))
  }

  private async _getDownloadUrl(software: string, version: string): Promise<string> {
    switch (software) {
      case 'vanilla': {
        const manifest = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')
        const ver = manifest.data.versions.find((v: any) => v.id === version)
        if (!ver) throw new Error(`Versión vanilla ${version} no encontrada`)
        const verMeta = await axios.get(ver.url)
        return verMeta.data.downloads.server.url
      }

      case 'paper': {
        const res = await axios.get(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/latest`,
          { headers: { 'User-Agent': PAPER_UA } }
        )
        const url = res.data?.downloads?.["server:default"]?.url
        if (!url) throw new Error(`No se encontró el JAR para Paper ${version}`)
        return url
      }

      case 'purpur':
        return `https://api.purpurmc.org/v2/purpur/${version}/latest/download`

      case 'fabric': {
        const loaderRes       = await axios.get('https://meta.fabricmc.net/v2/versions/loader')
        const latestLoader    = loaderRes.data[0].version
        const installerRes    = await axios.get('https://meta.fabricmc.net/v2/versions/installer')
        const latestInstaller = installerRes.data[0].version
        return `https://meta.fabricmc.net/v2/versions/loader/${version}/${latestLoader}/${latestInstaller}/server/jar`
      }

      default:
        throw new Error(`Descarga automática no soportada para ${software}. Sube el JAR manualmente.`)
    }
  }
}

function formatBytes(b: number): string {
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}