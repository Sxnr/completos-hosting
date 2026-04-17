import DashboardLayout from '../layouts/DashboardLayout'
import MetricCard from '../components/MetricCard'
import { useMetrics } from '../hooks/useMetrics'
import '../styles/dashboard.css'

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export default function DashboardPage() {
  // connected indica si el WebSocket está activo
  const { metrics, loading, connected } = useMetrics()

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        {/* ── Header ─────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Estado en tiempo real del servidor</p>
          </div>

          <div className="server-status">
            {/* Punto verde si WebSocket conectado, rojo si no */}
            <span className={`status-dot ${connected ? 'status-dot--online' : 'status-dot--offline'}`} />
            <span className={`badge ${connected ? 'badge-online' : 'badge-offline'}`}>
              {connected ? 'Online' : 'Reconectando...'}
            </span>
            {metrics && (
              <span className="status-uptime">
                Uptime: {formatUptime(metrics.uptime)}
              </span>
            )}
          </div>
        </div>

        {/* ── Info del servidor ───────────────────────── */}
        {metrics && (
          <div className="server-info card">
            <div className="server-info-item">
              <span className="server-info-label">Hostname</span>
              <span className="server-info-value">{metrics.hostname}</span>
            </div>
            <div className="server-info-divider" />
            <div className="server-info-item">
              <span className="server-info-label">Sistema</span>
              <span className="server-info-value">{metrics.os}</span>
            </div>
            <div className="server-info-divider" />
            <div className="server-info-item">
              <span className="server-info-label">CPU</span>
              <span className="server-info-value">{metrics.cpu.model}</span>
            </div>
            <div className="server-info-divider" />
            <div className="server-info-item">
              <span className="server-info-label">Load Avg</span>
              <span className="server-info-value font-mono">
                {metrics.loadAvg.map(n => n.toFixed(2)).join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* ── Grid de métricas ────────────────────────── */}
        {loading ? (
          <div className="metrics-grid">
            {[1,2,3,4].map(i => (
              <div key={i} className="card">
                <div className="skeleton skeleton-heading" />
                <div className="skeleton" style={{ height: 36, marginBottom: 12 }} />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="metrics-grid">

            <MetricCard
              title="CPU"
              value={`${metrics.cpu.usage}%`}
              percent={metrics.cpu.usage}
              subtitle={`${metrics.cpu.cores} cores${metrics.cpu.temp ? ` · ${metrics.cpu.temp}°C` : ''}`}
              colorClass="cpu"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                  <rect x="9" y="9" width="6" height="6"/>
                  <line x1="9" y1="1" x2="9" y2="4"/>
                  <line x1="15" y1="1" x2="15" y2="4"/>
                  <line x1="9" y1="20" x2="9" y2="23"/>
                  <line x1="15" y1="20" x2="15" y2="23"/>
                  <line x1="20" y1="9" x2="23" y2="9"/>
                  <line x1="20" y1="15" x2="23" y2="15"/>
                  <line x1="1" y1="9" x2="4" y2="9"/>
                  <line x1="1" y1="15" x2="4" y2="15"/>
                </svg>
              }
            />

            <MetricCard
              title="RAM"
              value={`${metrics.ram.used.toFixed(1)} / ${metrics.ram.total} GB`}
              percent={metrics.ram.percent}
              subtitle={`${(metrics.ram.total - metrics.ram.used).toFixed(1)} GB libres`}
              colorClass="ram"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="10" rx="2"/>
                  <line x1="6" y1="7" x2="6" y2="3"/>
                  <line x1="10" y1="7" x2="10" y2="3"/>
                  <line x1="14" y1="7" x2="14" y2="3"/>
                  <line x1="18" y1="7" x2="18" y2="3"/>
                  <line x1="6" y1="21" x2="6" y2="17"/>
                  <line x1="10" y1="21" x2="10" y2="17"/>
                  <line x1="14" y1="21" x2="14" y2="17"/>
                  <line x1="18" y1="21" x2="18" y2="17"/>
                </svg>
              }
            />

            <MetricCard
              title="Disco"
              value={`${metrics.disk.used} / ${metrics.disk.total} GB`}
              percent={metrics.disk.percent}
              subtitle={`${metrics.disk.total - metrics.disk.used} GB libres`}
              colorClass="disk"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              }
            />

            <MetricCard
              title="Red"
              value={`↓ ${metrics.network.rx.toFixed(1)} MB/s`}
              percent={Math.min(Math.round((metrics.network.rx / 100) * 100), 100)}
              subtitle={`↑ ${metrics.network.tx.toFixed(1)} MB/s enviados`}
              colorClass="cpu"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              }
            />

          </div>
        ) : null}

      </div>
    </DashboardLayout>
  )
}