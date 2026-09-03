// =========================================================
// MINECRAFT NETWORK TAB — Red y Dominio
// Publica un subdominio amigable (<sub>.quesitohosting.shop)
// con registro SRV (_minecraft._tcp) + CNAME al túnel Cloudflare.
// Permite a los jugadores conectar sin escribir el puerto.
// =========================================================

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { api, getApiError } from '../services/api'
import { toast } from './Toast'

const MC_DOMAIN = 'quesitohosting.shop'

interface NetworkInfo {
  allocated_port: number
  subdomain: string | null
  dns_created: boolean
  fqdn: string | null
  srv: string | null
  connection: string | null
}

interface MinecraftNetworkTabProps {
  instanceId: number
  allocatedPort?: number | null
}

export default function MinecraftNetworkTab({
  instanceId,
  allocatedPort,
}: MinecraftNetworkTabProps) {
  const reduceMotion = useReducedMotion()

  const [info, setInfo] = useState<NetworkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const port = info?.allocated_port ?? allocatedPort ?? 0
  const hasDomain = info?.dns_created === true && !!info?.fqdn
  const preview = useMemo(() => {
    const label = subdomain.trim() || 'tu-servidor'
    return `${label}.${MC_DOMAIN}`
  }, [subdomain])

  const loadNetwork = async () => {
    try {
      const res = await api.get<NetworkInfo>(`/api/minecraft/${instanceId}/network`)
      setInfo(res.data)
    } catch (err) {
      setError(getApiError(err, 'No se pudo cargar el estado de red'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNetwork()
  }, [instanceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const normalize = (value: string) => {
    const clean = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    return clean.slice(0, 63)
  }

  const onSubdomainChange = (value: string) => {
    setSubdomain(value)
    setFieldError(null)
  }

  const generate = async () => {
    const clean = normalize(subdomain)
    if (!clean) {
      setFieldError('Escribe un nombre de subdominio primero')
      return
    }

    setProvisioning(true)
    setError(null)
    setFieldError(null)
    try {
      const res = await api.post<{ success: boolean; network: NetworkInfo }>(
        `/api/minecraft/${instanceId}/network`,
        { subdomain: clean },
      )
      setInfo(res.data.network)
      toast.success('Dominio generado correctamente')
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error

      if (status === 400 && code === 'subdomain_taken') {
        setFieldError('Este subdominio ya está en uso. Prueba con otro nombre.')
      } else {
        setError(getApiError(err, 'No se pudo publicar el dominio'))
      }
    } finally {
      setProvisioning(false)
    }
  }

  const fade = () =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }

  if (loading) {
    return (
      <div className="mcn mcn-loading" role="status" aria-live="polite">
        <div className="mcn-loading-card">
          <Spinner size={22} />
          <span className="mcn-loading-text">Cargando estado de red…</span>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="mcn"
      {...fade()}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mcn-card mcn-hero">
        <div className="mcn-hero-icon">
          <span className="mcn-hero-glyph">⇢</span>
        </div>
        <div className="mcn-hero-text">
          <h3 className="mcn-title">Dirección de conexión amigable</h3>
          <p className="mcn-subtitle">
            Los jugadores conectan con un dominio sin escribir el puerto.
            El registro <span className="mcn-mono">SRV _minecraft</span> redirige
            automáticamente al puerto real a través del túnel Cloudflare.
          </p>
        </div>
      </div>

      {error && (
        <div className="mcn-error" role="alert">
          {error}
          <button className="mcn-error-retry" onClick={loadNetwork}>
            Reintentar
          </button>
        </div>
      )}

      {hasDomain ? (
        <motion.div className="mcn-card" {...fade()} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <div className="mcn-section-title">
            <span className="mcn-badge mcn-badge--ok">Activo</span>
            <span>Dominio publicado</span>
          </div>

          <div className="mcn-copy-row">
            <div className="mcn-copy-label">IP / Dominio</div>
            <code className="mcn-ip">{info?.fqdn}</code>
            <button
              className="mcn-copy"
              onClick={() => copyText(info?.fqdn ?? '')}
            >
              Copiar
            </button>
          </div>

          <div className="mcn-copy-row">
            <div className="mcn-copy-label">Puerto</div>
            <code className="mcn-ip">{port}</code>
            <button className="mcn-copy" onClick={() => copyText(String(port))}>
              Copiar
            </button>
          </div>

          <div className="mcn-srv">
            <span className="mcn-srv-label">Registro SRV detectado:</span>
            <code className="mcn-srv-code">{info?.srv}</code>
            <span className="mcn-srv-hint">
              El cliente lo resuelve automáticamente — no reescribas el puerto.
            </span>
          </div>
        </motion.div>
      ) : (
        <motion.div className="mcn-card" {...fade()} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <p className="mcn-empty-text">
            Esta instancia aún no tiene un dominio público.
          </p>
        </motion.div>
      )}

      <form
        className="mcn-card mcn-form"
        onSubmit={(e) => {
          e.preventDefault()
          generate()
        }}
      >
        <div className="mcn-section-title">
          <span className="mcn-badge">Nuevo</span>
          <span>Genera tu dominio (SRV + CNAME)</span>
        </div>

        <label className="mcn-field" htmlFor="mcn-subdomain">
          <span className="mcn-field-label">Prefijo del subdominio</span>
          <div className={`mcn-input-wrap ${fieldError ? 'mcn-input-wrap--error' : ''}`}>
            <input
              id="mcn-subdomain"
              type="text"
              className="mcn-input"
              placeholder="ej. server1"
              value={subdomain}
              onChange={(e) => onSubdomainChange(e.target.value)}
              disabled={provisioning}
              maxLength={63}
              autoComplete="off"
            />
            <span className="mcn-input-suffix">.{MC_DOMAIN}</span>
          </div>
          {fieldError && <span className="mcn-field-error">{fieldError}</span>}
        </label>

        <motion.div
          className="mcn-preview"
          key={preview}
          {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 } })}
          transition={{ duration: 0.2 }}
        >
          <span className="mcn-preview-label">Vista previa</span>
          <code className="mcn-preview-ip">{preview}</code>
          <span className="mcn-preview-port">:{port || '··'}</span>
          {provisioning && <Spinner />}
        </motion.div>

        <div className="mcn-form-actions">
          <button type="submit" className="btn btn-primary mcn-submit" disabled={provisioning}>
            {provisioning ? 'Publicando dominio…' : 'Generar IP de conexión'}
          </button>
        </div>
        <p className="mcn-form-hint">
          Se creará automáticamente el registro <span className="mcn-mono">SRV _minecraft._tcp</span>{' '}
          y el <span className="mcn-mono">CNAME</span> hacia el túnel Cloudflare.
        </p>
      </form>
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────

interface SpinnerProps {
  size?: number
}

function Spinner({ size = 16 }: SpinnerProps) {
  const reduceMotion = useReducedMotion()
  return (
    <span
      className="mcn-spinner"
      style={{ width: size, height: size }}
      aria-label={reduceMotion ? 'Procesando' : undefined}
    />
  )
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  } catch {
    toast.error('No se pudo copiar')
  }
}
