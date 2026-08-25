// =========================================================
// HOOK — useBotsConsole
// Conecta al WebSocket de consola de un bot y acumula líneas
// =========================================================

import { useState, useEffect, useRef } from 'react'

export interface ConsoleLine {
  id: number
  text: string
  ts: number
}

export type BotStatus = 'offline' | 'starting' | 'running' | 'stopping' | 'crashed'

export function useBotsConsole(botId: number | null) {
  const [lines, setLines]       = useState<ConsoleLine[]>([])
  const [status, setStatus]     = useState<BotStatus>('offline')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const idRef = useRef<number | null>(null)

  useEffect(() => {
    if (!botId) return
    let destroyed = false
    idRef.current = botId

    const connect = () => {
      if (destroyed || idRef.current == null) return
      const id = idRef.current
      const token = sessionStorage.getItem('token')
      // Importamos el servicio de forma diferida para evitar ciclos
      const base = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
      const ws = new WebSocket(`${base}/api/bots/${id}/console/ws?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => { if (!destroyed) setConnected(true) }

      ws.onmessage = (event) => {
        if (destroyed) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'history') {
            setLines(msg.lines.map((t: string, i: number) => ({ id: i, text: t, ts: Date.now() + i })))
          } else if (msg.type === 'console') {
            setLines(prev => [...prev, { id: Date.now() + prev.length, text: msg.line, ts: Date.now() }].slice(-2000))
          } else if (msg.type === 'status') {
            setStatus(msg.status)
          } else if (msg.type === 'error') {
            setLines(prev => [...prev, { id: Date.now() + prev.length, text: `[error] ${msg.message}`, ts: Date.now() }])
          }
        } catch {}
      }

      ws.onerror = () => { if (!destroyed) setConnected(false) }
      ws.onclose = () => {
        if (destroyed) return
        setConnected(false)
        setTimeout(() => { if (!destroyed && idRef.current === id) connect() }, 3000)
      }
    }

    connect()

    return () => {
      destroyed = true
      wsRef.current?.close()
    }
  }, [botId])

  const sendCommand = (command: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command }))
    }
  }

  const clear = () => setLines([])

  return { lines, status, connected, sendCommand, clear }
}

export default useBotsConsole
