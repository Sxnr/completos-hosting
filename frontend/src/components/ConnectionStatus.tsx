// =========================================================
// CONNECTION STATUS — Indicador live del estado del WS
// Abre un WebSocket liviano a /api/metrics/live y reporta
// online / connecting / offline con reconexión automática.
// =========================================================

import { useEffect, useState } from 'react'
import '../styles/connection.css'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

type Status = 'online' | 'connecting' | 'offline'

export default function ConnectionStatus({ collapsed = false }: { collapsed?: boolean }) {
  const [status, setStatus] = useState<Status>('connecting')

  useEffect(() => {
    let ws: WebSocket | null = null
    let cancelled = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      const token = sessionStorage.getItem('token')
      if (!token) { setStatus('offline'); return }
      setStatus('connecting')
      const url = `${WS_URL}/api/metrics/live?token=${encodeURIComponent(token)}`
      try {
        ws = new WebSocket(url)
      } catch {
        setStatus('offline')
        return
      }
      ws.onopen = () => { setStatus('online'); retry = 0 }
      ws.onclose = () => {
        if (cancelled) return
        setStatus('offline')
        retry = Math.min(retry + 1, 6)
        const delay = Math.min(1000 * 2 ** retry, 15000)
        timer = setTimeout(connect, delay)
      }
      ws.onerror = () => { try { ws?.close() } catch { /* noop */ } }
    }

    connect()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      try { ws?.close() } catch { /* noop */ }
    }
  }, [])

  const label =
    status === 'online' ? 'En vivo' :
    status === 'connecting' ? 'Conectando…' : 'Sin conexión'

  return (
    <div
      className={`conn-status conn-status--${status} ${collapsed ? 'conn-status--collapsed' : ''}`}
      title={`Servidor: ${label}`}
    >
      <span className="conn-dot" />
      {!collapsed && <span className="conn-label">{label}</span>}
    </div>
  )
}
