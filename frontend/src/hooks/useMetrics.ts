// =========================================================
// HOOK — useMetrics
// Se conecta al WebSocket del backend para datos en tiempo real
// Fallback automático a datos vacíos si el servidor no responde
// =========================================================

import { useState, useEffect, useRef } from 'react'
import type { SystemMetrics } from '../types/metrics'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

export function useMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  // Ref para el WebSocket — persiste entre renders sin causar re-renders
  const wsRef = useRef<WebSocket | null>(null)
  // Ref para el timeout de reconexión
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let destroyed = false   // Evita actualizaciones de estado si el componente se desmontó

    const connect = () => {
      if (destroyed) return

      const token = sessionStorage.getItem('token')
      // Agrega el token como query param para autenticar el WebSocket
      const ws = new WebSocket(`${WS_URL}/api/metrics/live?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (destroyed) return
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (destroyed) return
        try {
          // Parsea el JSON que llega del backend
          const data = JSON.parse(event.data) as SystemMetrics
          setMetrics(data)
          setLoading(false)
        } catch {
          console.error('Error parseando métricas del WebSocket')
        }
      }

      ws.onerror = () => {
        if (destroyed) return
        setConnected(false)
      }

      ws.onclose = () => {
        if (destroyed) return
        setConnected(false)
        // Intenta reconectar cada 3 segundos si se pierde la conexión
        reconnectRef.current = setTimeout(() => {
          if (!destroyed) connect()
        }, 3000)
      }
    }

    connect()

    // Limpieza al desmontar — cierra el WebSocket y cancela reconexión
    return () => {
      destroyed = true
      wsRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [])

  return { metrics, loading, connected }
}