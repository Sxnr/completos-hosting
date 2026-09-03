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

interface QuesiCatState {
  // Modo visual según contexto
  mode: QuesiCatMode
  // Si el PM2 detectó un proceso caído o en crash-loop
  hasError: boolean
  // Posición del cursor / de seguimiento (relativa al contenedor)
  pose: QuesiCatPose
  // Estado de los ojos (open / blink / closed)
  eyes: QuesiCatEyes
  // Flag para la transición login → dashboard
  revealed: boolean

  // Acciones
  setMode: (mode: QuesiCatMode) => void
  setPose: (pose: QuesiCatPose) => void
  setEyes: (eyes: QuesiCatEyes) => void
  reportError: (hasError: boolean) => void
  setRevealed: (revealed: boolean) => void
}

export const useQuesiCatStore = create<QuesiCatState>((set) => ({
  mode: 'neutral',
  hasError: false,
  pose: { x: 0, y: 0 },
  eyes: 'open',
  revealed: false,

  setMode: (mode) => set({ mode }),
  setPose: (pose) => set({ pose }),
  setEyes: (eyes) => set({ eyes }),
  reportError: (hasError) =>
    set({ hasError, mode: hasError ? 'alert' : 'neutral' }),
  setRevealed: (revealed) => set({ revealed }),
}))
