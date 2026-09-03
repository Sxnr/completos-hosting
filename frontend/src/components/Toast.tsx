// =========================================================
// TOAST — Sistema de notificaciones global (estilo Awwwards)
// Provee un provider + un singleton `toast` usable en cualquier
// parte (dentro o fuera de React) sin romper la lógica existente.
// =========================================================

/* eslint-disable react-refresh/only-export-components --
   El singleton `toast` y el hook `useToast` se exportan junto al
   provider a propósito: son la API pública de este módulo y se usan
   desde todas las páginas. Separarlos a otro archivo no aporta valor
   (react-refresh solo afecta al HMR en desarrollo). */

import {
  createContext, useState, useCallback, useEffect, useRef,
  type ReactNode,
} from 'react'
import '../styles/toast.css'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  type: ToastType
  msg: string
}

type Emit = (type: ToastType, msg: string) => void

const ToastContext = createContext<{ push: Emit } | null>(null)

// Puente para el singleton global (usable sin hook)
let _emit: Emit | null = null
let _id = 0

export const toast = {
  success: (msg: string) => _emit?.('success', msg),
  error:   (msg: string) => _emit?.('error', msg),
  info:    (msg: string) => _emit?.('info', msg),
  warning: (msg: string) => _emit?.('warning', msg),
}

// Hook opcional para componentes React
export function useToast() {
  return { toast }
}

function Icon({ type }: { type: ToastType }) {
  const c = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (type) {
    case 'success':
      return (<svg {...c}><polyline points="20 6 9 17 4 12" /></svg>)
    case 'error':
      return (<svg {...c}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
    case 'warning':
      return (<svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>)
    default:
      return (<svg {...c}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>)
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
    const t = timers.current[id]
    if (t) { clearTimeout(t); delete timers.current[id] }
  }, [])

  const push = useCallback<Emit>((type, msg) => {
    const id = ++_id
    setItems(prev => [...prev, { id, type, msg }])
    timers.current[id] = setTimeout(() => remove(id), 4500)
  }, [remove])

  // Exponer al singleton global
  useEffect(() => {
    _emit = push
    return () => { _emit = null }
  }, [push])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map(t => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            onClick={() => remove(t.id)}
            role="status"
          >
            <span className="toast-icon"><Icon type={t.type} /></span>
            <span className="toast-msg">{t.msg}</span>
            <span className="toast-bar" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
