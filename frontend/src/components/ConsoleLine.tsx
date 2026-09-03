// =========================================================
// CONSOLE LINE — Línea de consola animada (WebSocket)
// Cada mensaje entrante hace fade-in + leve desplazamiento
// desde la derecha, sin sacrificar la legibilidad (ISO 9241:
// el movimiento es sutil y no dificulta la lectura de logs).
// Con `prefers-reduced-motion` el elemento se muestra estático.
// =========================================================

import { motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface ConsoleLineProps {
  id: number | string
  children: ReactNode
  className?: string
}

export default function ConsoleLine({ id, children, className = '' }: ConsoleLineProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      layout
      key={id}
      className={`console-line ${className}`.trim()}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      // Legibilidad: desactivar el subpixel/animación de layout en las líneas
      // largas no es necesario, pero evitamos saltos al hacer scroll
    >
      {children}
    </motion.div>
  )
}
