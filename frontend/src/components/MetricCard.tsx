// =========================================================
// METRIC CARD — Card de métrica con barra de progreso
// Recibe nombre, valor, porcentaje y color temático
// =========================================================

import '../styles/metriccard.css'

interface MetricCardProps {
  title:    string
  value:    string          // Texto principal (ej: "7.2 / 16 GB")
  percent:  number          // 0-100 para la barra de progreso
  subtitle?: string         // Info adicional debajo del valor
  colorClass: 'cpu' | 'ram' | 'disk' | 'warn' | 'crit'
  icon:     React.ReactNode
}

// Determina el color semántico según el porcentaje
const getColorClass = (percent: number, base: string): string => {
  if (percent >= 90) return 'crit'   // Crítico — rojo
  if (percent >= 70) return 'warn'   // Advertencia — amarillo
  return base                         // Normal — color base
}

export default function MetricCard({
  title, value, percent, subtitle, colorClass, icon
}: MetricCardProps) {
  // Sobreescribe el color base si el porcentaje es alto
  const activeColor = getColorClass(percent, colorClass)

  return (
    <div className="metric-card card">

      {/* Header: ícono + título */}
      <div className="metric-card-header">
        <span className={`metric-card-icon metric-icon--${activeColor}`}>
          {icon}
        </span>
        <span className="metric-card-title">{title}</span>
      </div>

      {/* Valor principal */}
      <div className="metric-card-value">{value}</div>

      {/* Barra de progreso con color dinámico */}
      <div className="progress-bar">
        <div
          className={`progress-fill ${activeColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>

      {/* Porcentaje y subtítulo */}
      <div className="metric-card-footer">
        <span className={`metric-card-percent metric-percent--${activeColor}`}>
          {percent}%
        </span>
        {subtitle && (
          <span className="metric-card-subtitle">{subtitle}</span>
        )}
      </div>

    </div>
  )
}