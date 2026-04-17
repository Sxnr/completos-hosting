// =========================================================
// SERVER INFO STRIP — Información detallada del servidor
// Muestra hostname, OS, CPU, núcleos, temperatura y load avg
// =========================================================

import type { SystemMetrics } from '../types/metrics'
import '../styles/serverinfo.css'

interface Props {
  metrics: SystemMetrics
}

export default function ServerInfoStrip({ metrics }: Props) {
  return (
    <div className="server-info-strip card">

      {/* Hostname */}
      <div className="info-item">
        <span className="info-label">Hostname</span>
        <span className="info-value">{metrics.hostname}</span>
      </div>

      <div className="info-divider" />

      {/* Sistema operativo */}
      <div className="info-item">
        <span className="info-label">Sistema</span>
        <span className="info-value">{metrics.os}</span>
      </div>

      <div className="info-divider" />

      {/* CPU modelo + núcleos */}
      <div className="info-item">
        <span className="info-label">Procesador</span>
        <span className="info-value">{metrics.cpu.model}</span>
        <span className="info-badge">{metrics.cpu.cores} núcleos</span>
      </div>

      <div className="info-divider" />

      {/* Temperatura — solo si está disponible */}
      <div className="info-item">
        <span className="info-label">Temperatura</span>
        {metrics.cpu.temp ? (
          <span className={`info-value info-temp ${
            metrics.cpu.temp >= 80 ? 'info-temp--hot' :
            metrics.cpu.temp >= 65 ? 'info-temp--warm' : 'info-temp--ok'
          }`}>
            {metrics.cpu.temp}°C
          </span>
        ) : (
          <span className="info-value" style={{ color: 'var(--color-text-faint)' }}>
            N/D
          </span>
        )}
      </div>

      <div className="info-divider" />

      {/* Load average — los 3 valores */}
      <div className="info-item">
        <span className="info-label">Load Avg</span>
        <div className="info-loadavg">
          {metrics.loadAvg.map((val, i) => (
            <span key={i} className="info-loadavg-item">
              <span className="info-loadavg-label">
                {i === 0 ? '1m' : i === 1 ? '5m' : '15m'}
              </span>
              <span className={`info-loadavg-val ${
                val > metrics.cpu.cores ? 'info-temp--hot' :
                val > metrics.cpu.cores * 0.7 ? 'info-temp--warm' : ''
              }`}>
                {val.toFixed(2)}
              </span>
            </span>
          ))}
        </div>
      </div>

    </div>
  )
}