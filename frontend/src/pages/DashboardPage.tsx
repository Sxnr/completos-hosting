// =========================================================
// DASHBOARD PAGE — Overview completo con métricas y gráficos
// =========================================================

import DashboardLayout   from '../layouts/DashboardLayout'
import MetricCard        from '../components/MetricCard'
import MetricChart       from '../components/MetricChart'
import ServerInfoStrip   from '../components/ServerInfoStrip'
import { useMetrics }    from '../hooks/useMetrics'
import '../styles/dashboard.css'

// Convierte segundos a string legible "Xd Xh Xm"
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

// Colores temáticos para cada gráfico — coinciden con las cards
const CHART_COLORS = {
  cpu:  '#539bf5',   // Azul pizarra
  ram:  '#986ee2',   // Lavanda
  disk: '#39c5cf',   // Teal
  net:  '#57ab5a',   // Verde
}

export default function DashboardPage() {
  const { metrics, history, loading, connected } = useMetrics()

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
        {metrics && <ServerInfoStrip metrics={metrics} />}

        {/* ── Skeleton mientras carga ─────────────────── */}
        {loading && (
          <>
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
            <div className="charts-grid">
              {[1,2,3,4].map(i => (
                <div key={i} className="card" style={{ minHeight: 200 }}>
                  <div className="skeleton skeleton-heading" />
                  <div className="skeleton" style={{ flex: 1, minHeight: 140 }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Contenido real ──────────────────────────── */}
        {!loading && metrics && (
          <>
            {/* Cards de métricas actuales */}
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
                    <line x1="9"  y1="1"  x2="9"  y2="4"/>
                    <line x1="15" y1="1"  x2="15" y2="4"/>
                    <line x1="9"  y1="20" x2="9"  y2="23"/>
                    <line x1="15" y1="20" x2="15" y2="23"/>
                    <line x1="20" y1="9"  x2="23" y2="9"/>
                    <line x1="20" y1="15" x2="23" y2="15"/>
                    <line x1="1"  y1="9"  x2="4"  y2="9"/>
                    <line x1="1"  y1="15" x2="4"  y2="15"/>
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
                    <line x1="6"  y1="7"  x2="6"  y2="3"/>
                    <line x1="10" y1="7"  x2="10" y2="3"/>
                    <line x1="14" y1="7"  x2="14" y2="3"/>
                    <line x1="18" y1="7"  x2="18" y2="3"/>
                    <line x1="6"  y1="21" x2="6"  y2="17"/>
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

            {/* Gráficos históricos — 2 columnas */}
            <div className="section-title">Historial — últimos 2 minutos</div>
            <div className="charts-grid">

              <MetricChart
                title="CPU"
                data={history}
                dataKey="cpu"
                color={CHART_COLORS.cpu}
                unit="%"
                maxValue={100}
                subtitle={`${metrics.cpu.cores} núcleos · ${metrics.cpu.model}`}
              />

              <MetricChart
                title="RAM"
                data={history}
                dataKey="ram"
                color={CHART_COLORS.ram}
                unit="%"
                maxValue={100}
                subtitle={`${metrics.ram.total} GB total`}
              />

              <MetricChart
                title="Disco"
                data={history}
                dataKey="disk"
                color={CHART_COLORS.disk}
                unit="%"
                maxValue={100}
                subtitle={`${metrics.disk.total} GB total`}
              />

              <MetricChart
                title="Red — Entrada"
                data={history}
                dataKey="rxMbps"
                color={CHART_COLORS.net}
                unit=" MB/s"
                maxValue={100}
                subtitle={`Salida actual: ${metrics.network.tx.toFixed(1)} MB/s`}
              />

            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  )
}