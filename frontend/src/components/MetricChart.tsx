// =========================================================
// METRIC CHART — Gráfico de línea histórico con Recharts
// Muestra el historial de una métrica con gradiente de área
// =========================================================

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import type { HistoryPoint } from '../hooks/useMetrics'
import '../styles/metricchart.css'

interface MetricChartProps {
  title:     string
  data:      HistoryPoint[]
  dataKey:   keyof HistoryPoint        // Qué campo del historial graficar
  color:     string                    // Color del trazo y gradiente
  unit:      string                    // Unidad del eje Y (ej: "%", "MB/s")
  maxValue?: number                    // Valor máximo del eje Y (default: 100)
  subtitle?: string                    // Info adicional en el header
}

// Tooltip personalizado con el estilo del dashboard
const CustomTooltip = ({ active, payload, label, unit }: {
  active?:  boolean
  payload?: Array<{ value: number }>
  label?:   string
  unit:     string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-time">{label}</span>
      <span className="chart-tooltip-value">
        {payload[0].value.toFixed(1)}{unit}
      </span>
    </div>
  )
}

export default function MetricChart({
  title, data, dataKey, color, unit, maxValue = 100, subtitle
}: MetricChartProps) {
  // ID único para el gradiente SVG — evita conflictos entre charts
  const gradientId = `gradient-${dataKey}`

  // Valor actual — el último punto del historial
  const current = data.length > 0
    ? Number(data[data.length - 1][dataKey]).toFixed(1)
    : '—'

  return (
    <div className="metric-chart card">

      {/* Header del gráfico */}
      <div className="metric-chart-header">
        <div>
          <span className="metric-chart-title">{title}</span>
          {subtitle && (
            <span className="metric-chart-subtitle">{subtitle}</span>
          )}
        </div>
        {/* Valor actual grande a la derecha */}
        <span className="metric-chart-current" style={{ color }}>
          {current}{unit}
        </span>
      </div>

      {/* Gráfico de área con gradiente */}
      <div className="metric-chart-body">
        {data.length < 2 ? (
          // Placeholder mientras se acumula historial
          <div className="chart-waiting">
            <span>Acumulando datos...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              {/* Definición del gradiente de área */}
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Grid sutil de fondo */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />

              {/* Eje X — muestra solo algunos labels para no saturar */}
              <XAxis
                dataKey="time"
                tick={{ fill: 'var(--color-text-faint)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              {/* Eje Y — de 0 al máximo con el color atenuado */}
              <YAxis
                domain={[0, maxValue]}
                tick={{ fill: 'var(--color-text-faint)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v}${unit}`}
              />

              {/* Tooltip personalizado */}
              <Tooltip
                content={<CustomTooltip unit={unit} />}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
              />

              {/* Área con gradiente y línea principal */}
              <Area
                type="monotone"
                dataKey={dataKey as string}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                isAnimationActive={false}  // Desactivado para tiempo real fluido
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}