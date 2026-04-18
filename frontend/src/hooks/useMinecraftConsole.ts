// =========================================================
// useMinecraftConsole — Hook React para el WS de consola
// =========================================================
// Maneja la conexión WebSocket con reconexión automática,
// historial de consola, estado del servidor y envío de comandos.
// =========================================================

import { useEffect, useRef, useCallback, useState } from 'react'

// ── Tipos ─────────────────────────────────────────────────

export type ServerStatus = 'offline' | 'starting' | 'online' | 'stopping'

export interface ConsoleLine {
  id:   number
  text: string
  ts:   number   // timestamp en ms
}

export interface UseMinecraftConsoleReturn {
  lines:       ConsoleLine[]
  status:      ServerStatus
  playerCount: number
  players:     string[]
  connected:   boolean
  sendCommand: (cmd: string) => void
  clearConsole: () => void
}

// ── Configuración ─────────────────────────────────────────

const WS_BASE_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001'
const MAX_LINES    = 500   // máximo de líneas en memoria
const RECONNECT_MS = 3_000 // tiempo base entre reconexiones
const MAX_RETRIES  = 10    // intentos máximos antes de rendirse

// ── Hook ──────────────────────────────────────────────────

export function useMinecraftConsole(
  instanceId: number | null,
): UseMinecraftConsoleReturn {
  const [lines,       setLines]       = useState<ConsoleLine[]>([])
  const [status,      setStatus]      = useState<ServerStatus>('offline')
  const [playerCount, setPlayerCount] = useState(0)
  const [players,     setPlayers]     = useState<string[]>([])
  const [connected,   setConnected]   = useState(false)

  const wsRef       = useRef<WebSocket | null>(null)
  const retriesRef  = useRef(0)
  const lineIdRef   = useRef(0)
  const mountedRef  = useRef(true)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ────────────────────────────────────────────

  const nextId = () => ++lineIdRef.current

  const addLine = useCallback((text: string) => {
    setLines(prev => {
      const next = [...prev, { id: nextId(), text, ts: Date.now() }]
      // Recorta si supera el límite
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  const addLines = useCallback((texts: string[]) => {
    setLines(prev => {
      const newLines = texts.map(text => ({ id: nextId(), text, ts: Date.now() }))
      const next = [...prev, ...newLines]
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  // ── Conexión WS ────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current || instanceId === null) return

    // Evita doble conexión
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const token = sessionStorage.getItem('token')
    if (!token) {
      addLine('[Sistema] No hay token de autenticación.')
      return
    }

    const url = `${WS_BASE_URL}/api/minecraft/${instanceId}/console/ws?token=${token}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      retriesRef.current = 0
      setConnected(true)
      addLine('[Sistema] Consola conectada.')
    }

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data as string)

        switch (msg.type) {
          case 'history':
            // Historial acumulado al conectarse
            addLines((msg.lines as string[]) ?? [])
            break

          case 'console':
            addLine(msg.line as string)
            break

          case 'status':
            setStatus(msg.status as ServerStatus)
            setPlayerCount(msg.playerCount ?? 0)
            setPlayers(msg.players ?? [])
            break

          case 'playerJoin':
            setPlayerCount(msg.playerCount ?? 0)
            setPlayers(msg.players ?? [])
            addLine(`[Sistema] ${msg.player} se conectó.`)
            break

          case 'playerLeave':
            setPlayerCount(msg.playerCount ?? 0)
            setPlayers(msg.players ?? [])
            addLine(`[Sistema] ${msg.player} se desconectó.`)
            break

          case 'pong':
            // Heartbeat OK — no hace nada visible
            break

          case 'error':
            addLine(`[Error] ${msg.message}`)
            break
        }
      } catch {
        // Mensaje no-JSON — lo agrega tal cual
        addLine(event.data as string)
      }
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      setConnected(false)

      // 1000 = cierre limpio (el usuario cerró el tab / cambió de página)
      if (event.code === 1000) {
        addLine('[Sistema] Consola desconectada.')
        return
      }

      // Reconexión con backoff exponencial
      if (retriesRef.current < MAX_RETRIES) {
        const delay = RECONNECT_MS * Math.min(2 ** retriesRef.current, 16)
        retriesRef.current++
        addLine(`[Sistema] Reconectando en ${delay / 1000}s... (intento ${retriesRef.current}/${MAX_RETRIES})`)
        timeoutRef.current = setTimeout(connect, delay)
      } else {
        addLine('[Sistema] No se pudo reconectar. Recarga la página para intentar de nuevo.')
      }
    }

    ws.onerror = () => {
      // El evento error siempre va seguido de onclose — no hace nada aquí
    }
  }, [instanceId, addLine, addLines])

  // ── Ping periódico (keepalive) ─────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25_000) // cada 25 s

    return () => clearInterval(interval)
  }, [])

  // ── Ciclo de vida ──────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true

    if (instanceId !== null) {
      // Reset al cambiar de instancia
      setLines([])
      setStatus('offline')
      setPlayerCount(0)
      setPlayers([])
      setConnected(false)
      retriesRef.current = 0
      connect()
    }

    return () => {
      // Limpieza al desmontar o cambiar instanceId
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close(1000)
        wsRef.current = null
      }
    }
  }, [instanceId, connect])

  // ── Unmount global ─────────────────────────────────────

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ── API pública ────────────────────────────────────────

  const sendCommand = useCallback((cmd: string) => {
    if (!cmd.trim()) return
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      addLine('[Sistema] No conectado — no se puede enviar el comando.')
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'command', command: cmd.trim() }))
  }, [addLine])

  const clearConsole = useCallback(() => {
    setLines([])
  }, [])

  return { lines, status, playerCount, players, connected, sendCommand, clearConsole }
}