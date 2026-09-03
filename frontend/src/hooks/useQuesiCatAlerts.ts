// =========================================================
// HOOK — useQuesiCatAlerts
// Conecta el "Quesi-Cat" con el estado real del supervisor
// (PM2 / BotManager). Sondea /api/bots en intervalos y, si
// algún bot está en estado 'crashed' o en crash-loop, activa
// la alerta global de la mascota (reportError) con diagnóstico.
//
// Cumple ISO/IEC 25010 (funcionalidad + mantenibilidad: la
// lógica de monitoreo vive aislada de la UI) e ISO 9241-110
// (el sistema informa proactivamente del estado al usuario).
// =========================================================

import { useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { useQuesiCatStore, type QuesiCatAlert } from '../stores/quesiCatStore'

// Estados considerados "proceso caído / crash-loop"
const ALERT_STATUSES = new Set(['crashed', 'stopping'])

const POLL_MS = 5000

export function useQuesiCatAlerts() {
  const reportError = useQuesiCatStore((s) => s.reportError)
  const firstRun = useRef(true)

  const checkAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/api/bots')
      const bots = Array.isArray(data?.bots) ? data.bots : []
      const alerts: QuesiCatAlert[] = bots
        .filter((b: { status?: string }) => b.status && ALERT_STATUSES.has(b.status))
        .map((b: { name: string; status?: string }) => ({
          kind: 'bot' as const,
          name: b.name,
          status: b.status as string,
          detail: b.status === 'stopping' ? 'Bot deteniéndose (posible cierre)' : 'Bot caído o en crash-loop',
        }))

      const hasError = alerts.length > 0

      // En la primera ejecución no interrumpir nada si no hay errores
      if (!hasError && firstRun.current) {
        firstRun.current = false
        reportError(false, [])
        return
      }
      firstRun.current = false

      if (hasError || alerts.length > 0) {
        reportError(hasError, alerts)
      } else {
        reportError(false, [])
      }
    } catch {
      // Sin backend / sin sesión: no alterar el estado del gato
    }
  }, [reportError])

  useEffect(() => {
    checkAlerts()
    const interval = setInterval(checkAlerts, POLL_MS)
    return () => clearInterval(interval)
  }, [checkAlerts])
}

export default useQuesiCatAlerts
