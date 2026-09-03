// =========================================================
// QUESI-CAT STORE — Estado global de la mascota (Zustand)
// Gestiona la posición, aspecto y estado emocional del
// "Quesi-Cat" a lo largo de toda la app. Las páginas pueden
// notificar errores (proceso caído / crash-loop) para que el
// gato entre en estado de alerta.
// =========================================================

import { create } from 'zustand'

// ── Modos de aspecto del Quesi-Cat según la ruta activa ──
export type QuesiCatMode =
  | 'neutral'     // Ruta general — observa métricas
  | 'bots'        // /bots — con auriculares gestionando bots
  | 'minecraft'   // /minecraft — con pico y acentos naranjas
  | 'alert'       // Error PM2 — proceso caído / crash-loop

// Posición fluida de la mascota (usada por Framer Motion)
export interface QuesiCatPose {
  x: number
  y: number
}

export type QuesiCatEyes = 'open' | 'blink' | 'closed'

// Proceso caído / crash-loop detectado (para diagnóstico accesible)
export interface QuesiCatAlert {
  kind: 'bot' | 'system'
  name: string
  status: string
  detail?: string
}

// Posible modo según la ruta (sin considerar alertas)
export type QuesiCatRouteMode = 'neutral' | 'bots' | 'minecraft'

interface QuesiCatState {
  // Modo visual según contexto (puede ser forzado a 'alert' por hasError)
  mode: QuesiCatMode
  // Modo correspondiente a la ruta activa únicamente
  routeMode: QuesiCatRouteMode
  // Si el supervisor detectó un proceso caído o en crash-loop
  hasError: boolean
  // Lista de procesos con problema (diagnóstico)
  alerts: QuesiCatAlert[]
  // Posición del cursor / de seguimiento (relativa al contenedor)
  pose: QuesiCatPose
  // Estado de los ojos (open / blink / closed)
  eyes: QuesiCatEyes
  // Flag para la transición login → dashboard
  revealed: boolean

  // Acciones
  setRouteMode: (routeMode: QuesiCatRouteMode) => void
  setMode: (mode: QuesiCatMode) => void
  setPose: (pose: QuesiCatPose) => void
  setEyes: (eyes: QuesiCatEyes) => void
  reportError: (hasError: boolean, alerts?: QuesiCatAlert[]) => void
  setRevealed: (revealed: boolean) => void
}

export const useQuesiCatStore = create<QuesiCatState>((set) => ({
  mode: 'neutral',
  routeMode: 'neutral',
  hasError: false,
  alerts: [],
  pose: { x: 0, y: 0 },
  eyes: 'open',
  revealed: false,

  setRouteMode: (routeMode) =>
    set((state) => ({
      routeMode,
      // Solo cambia el modo visual si no hay una alerta activa.
      // Si hay alerta, el gato permanece en modo alerta (tiene prioridad).
      mode: state.hasError ? 'alert' : routeMode,
    })),
  setMode: (mode) => set({ mode }),
  setPose: (pose) => set({ pose }),
  setEyes: (eyes) => set({ eyes }),
  reportError: (hasError, alerts = []) =>
    set((state) => ({
      hasError,
      alerts,
      // La alerta tiene prioridad sobre el modo de ruta
      mode: hasError ? 'alert' : state.routeMode,
    })),
  setRevealed: (revealed) => set({ revealed }),
}))
