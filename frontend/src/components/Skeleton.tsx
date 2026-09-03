// =========================================================
// SKELETON — Placeholder de carga reutilizable
// Muestra el esqueleto de una tarjeta mientras carga.
// Cumple ISO 9241-110 (feedback de sistema: el usuario sabe
// que hay contenido en camino) con reducción de movimiento.
// =========================================================

import { motion, useReducedMotion } from 'framer-motion'

interface SkeletonProps {
  count?: number
  height?: number | string
  className?: string
}

export default function Skeleton({ count = 3, height = 140, className = '' }: SkeletonProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className={`grid gap-4 ${className}`.trim()}
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      role="status"
      aria-live="polite"
      aria-label="Cargando contenido…"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="card skeleton"
          style={{ height }}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
