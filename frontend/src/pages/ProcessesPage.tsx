// =========================================================
// PROCESSES PAGE — Módulo de procesos y servicios
// Muestra tabla de procesos activos + estado de servicios
// =========================================================

import { useState } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { useProcesses } from '../hooks/useProcesses'
import '../styles/processes.css'

// Traduce el estado de un proceso a texto legible
const statusLabel: Record<string, string> = {
  R: 'Corriendo',
  S: 'Suspendido',
  D: 'Esperando I/O',
  Z: 'Zombie',
  T: 'Detenido',
}

// Color del badge de estado del servicio
const serviceStatusColor: Record<string, string> = {
  active:   'badge-online',
  inactive: 'badge-warning',
  failed:   'badge-offline',
  unknown:  'badge-info',
}

export default function ProcessesPage() {
  const { processes, services, loading, error, restartService } = useProcesses()
  const [restarting, setRestarting] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [feedback, setFeedback]     = useState<{ msg: string; ok: boolean } | null>(null)

  // Filtra procesos según el texto del buscador
  const filtered = processes.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.user.toLowerCase().includes(search.toLowerCase())
  )

  // Reinicia un servicio con feedback visual
  const handleRestart = async (name: string) => {
    setRestarting(name)
    const ok = await restartService(name)
    setRestarting(null)
    setFeedback({
      msg: ok ? `${name} reiniciado correctamente` : `Error al reiniciar ${name}`,
      ok,
    })
    // Limpia el feedback después de 3 segundos
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        {/* ── Header ─────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Procesos y Servicios</h1>
            <p className="page-subtitle">
              Monitoreo de procesos activos y estado de servicios del sistema
            </p>
          </div>
          {/* Badge de cantidad de procesos */}
          {!loading && (
            <span className="badge badge-info">
              {processes.length} procesos activos
            </span>
          )}
        </div>

        {/* ── Feedback de reinicio ────────────────────── */}
        {feedback && (
          <div className={`process-feedback ${feedback.ok ? 'process-feedback--ok' : 'process-feedback--error'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {feedback.ok
                ? <><polyline points="20 6 9 17 4 12"/></>
                : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
              }
            </svg>
            {feedback.msg}
          </div>
        )}

        {/* ── Error de conexión ───────────────────────── */}
        {error && (
          <div className="login-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Servicios del sistema ───────────────────── */}
        <div className="services-section">
          <div className="section-title">Servicios del sistema</div>
          <div className="services-grid">
            {loading
              ? [1,2,3,4,5,6].map(i => (
                  <div key={i} className="service-card card">
                    <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                ))
              : services.map(svc => (
                  <div key={svc.name} className="service-card card">

                    {/* Nombre y badge de estado */}
                    <div className="service-card-header">
                      <span className="service-card-name">{svc.name}</span>
                      <span className={`badge ${serviceStatusColor[svc.status]}`}>
                        {svc.status}
                      </span>
                    </div>

                    {/* PID si está activo */}
                    {svc.pid && (
                      <span className="service-card-pid">PID: {svc.pid}</span>
                    )}

                    {/* Botón de reinicio — solo para servicios activos */}
                    {svc.status === 'active' && (
                      <button
                        className="btn btn-ghost service-restart-btn"
                        onClick={() => handleRestart(svc.name)}
                        disabled={restarting === svc.name}
                      >
                        {restarting === svc.name ? (
                          <><span className="spinner" /> Reiniciando...</>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polyline points="23 4 23 10 17 10"/>
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            Reiniciar
                          </>
                        )}
                      </button>
                    )}

                  </div>
                ))
            }
          </div>
        </div>

        {/* ── Tabla de procesos ───────────────────────── */}
        <div className="processes-section">
          <div className="processes-header">
            <div className="section-title">Top procesos por CPU</div>
            {/* Buscador de procesos */}
            <input
              type="text"
              className="input process-search"
              placeholder="Buscar por nombre o usuario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="processes-table-wrap card">
            <table className="processes-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>CPU %</th>
                  <th>RAM (MB)</th>
                  <th>Estado</th>
                  <th>Uptime</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j}>
                            <div className="skeleton skeleton-text" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="process-empty">
                            {search ? `Sin resultados para "${search}"` : 'Sin procesos'}
                          </div>
                        </td>
                      </tr>
                    )
                    : filtered.map(proc => (
                        <tr key={proc.pid} className="process-row">
                          {/* PID en monoespaciado */}
                          <td>
                            <span className="process-pid">{proc.pid}</span>
                          </td>
                          {/* Nombre del proceso */}
                          <td>
                            <span className="process-name">{proc.name}</span>
                          </td>
                          {/* Usuario */}
                          <td>
                            <span className="process-user">{proc.user}</span>
                          </td>
                          {/* CPU con color dinámico según nivel */}
                          <td>
                            <span className={`process-cpu ${
                              proc.cpu >= 50 ? 'process-val--hot' :
                              proc.cpu >= 20 ? 'process-val--warm' :
                              'process-val--ok'
                            }`}>
                              {proc.cpu.toFixed(1)}%
                            </span>
                          </td>
                          {/* RAM */}
                          <td>
                            <span className="process-mem">{proc.memory} MB</span>
                          </td>
                          {/* Estado */}
                          <td>
                            <span className="process-status">
                              {statusLabel[proc.status[0]] || proc.status}
                            </span>
                          </td>
                          {/* Uptime */}
                          <td>
                            <span className="process-uptime">{proc.uptime}</span>
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}