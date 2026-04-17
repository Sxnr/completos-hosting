// =========================================================
// HOOK — useMetrics
// Conecta al WebSocket y acumula historial de los últimos
// 60 puntos (2 min a 2s de intervalo) para los gráficos
// =========================================================

import { useState, useEffect, useRef } from 'react'
import type { SystemMetrics } from '../types/metrics'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// Punto de historial para los gráficos
export interface HistoryPoint {
  time:    string    // Hora formateada "HH:MM:SS"
  cpu:     number
  ram:     number
  disk:    number
  rxMbps:  number
  txMbps:  number
}

// Máximo de puntos en el historial — 60 puntos = 2 minutos a 2s/punto
const MAX_HISTORY = 60

// Formatea timestamp a "HH:MM:SS"
const formatTime = () => new Date().toLocaleTimeString('es-CL', { hour12: false })

export function useMetrics() {
  const [metrics,   setMetrics]   = useState<SystemMetrics | null>(null)
  const [history,   setHistory]   = useState<HistoryPoint[]>([])
  const [loading,   setLoading]   = useState(true)
  const [connected, setConnected] = useState(false)

  const wsRef        = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let destroyed = false

    const connect = () => {
      if (destroyed) return

      const token = sessionStorage.getItem('token')
      const ws    = new WebSocket(`${WS_URL}/api/metrics/live?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (destroyed) return
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (destroyed) return
        try {
          const data = JSON.parse(event.data) as SystemMetrics
          setMetrics(data)
          setLoading(false)

          // Agrega el punto al historial — limita a MAX_HISTORY puntos
          setHistory(prev => {
            const point: HistoryPoint = {
              time:   formatTime(),
              cpu:    data.cpu.usage,
              ram:    data.ram.percent,
              disk:   data.disk.percent,
              rxMbps: data.network.rx,
              txMbps: data.network.tx,
            }
            // slice(-MAX_HISTORY) mantiene solo los últimos 60 puntos
            return [...prev, point].slice(-MAX_HISTORY)
          })
        } catch {
          console.error('Error parseando métricas del WebSocket')
        }
      }

      ws.onerror  = () => { if (!destroyed) setConnected(false) }
      ws.onclose  = () => {
        if (destroyed) return
        setConnected(false)
        reconnectRef.current = setTimeout(() => {
          if (!destroyed) connect()
        }, 3000)
      }
    }

    connect()

    return () => {
      destroyed = true
      wsRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [])

  return { metrics, history, loading, connected }
}