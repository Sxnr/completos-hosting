// =========================================================
// HOOK — useProcesses
// Obtiene procesos y servicios cada 5 segundos via REST
// (No necesita WebSocket — 5s es suficiente para procesos)
// =========================================================

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { ProcessInfo, ServiceInfo } from '../types/processes'

export function useProcesses() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [services,  setServices]  = useState<ServiceInfo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      // Obtiene procesos y servicios en paralelo
      const [procRes, svcRes] = await Promise.all([
        api.get<{ processes: ProcessInfo[] }>('/api/processes'),
        api.get<{ services:  ServiceInfo[]  }>('/api/services'),
      ])
      setProcesses(procRes.data.processes)
      setServices(svcRes.data.services)
      setError(null)
    } catch {
      setError('Error conectando con el backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Actualiza cada 5 segundos
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Reinicia un servicio y refresca el estado
  const restartService = async (service: string): Promise<boolean> => {
    try {
      await api.post('/api/services/restart', { service })
      await fetchData()
      return true
    } catch {
      return false
    }
  }

  return { processes, services, loading, error, restartService }
}