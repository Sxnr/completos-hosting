// =========================================================
// EMPTY STATE — Estado vacío accesible y reutilizable
// Mensaje claro cuando no hay datos que mostrar, con acción
// opcional. Cumple ISO 9241-110 (orientación al usuario:
// explica qué pasó y cómo seguir) y WCAG (aria, contraste).
// =========================================================

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
  className?: string
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`card flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`.trim()}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      role="status"
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-quesito-orange [background:var(--color-primary-dim)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-display text-lg font-semibold text-[var(--color-text)]">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button className="btn btn-primary mt-2" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </motion.div>
  )
}
