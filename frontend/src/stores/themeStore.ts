// =========================================================
// THEME STORE — Estado global del tema (Zustand)
// Controla el Modo Oscuro / Modo Claro de toda la app.
// Se aplica la clase `dark` sobre <html> (darkMode: 'class').
// =========================================================

import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'

interface ThemeState {
  theme: ThemeMode
  toggle: () => void
  setTheme: (theme: ThemeMode) => void
}

// Aplica la clase `dark` sobre <html> y persiste la elección
function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    sessionStorage.setItem('theme', theme)
  } catch {
    /* almacenamiento no disponible */
  }
}

// Tema inicial: oscuro por defecto, respetando lo guardado
function getInitialTheme(): ThemeMode {
  try {
    const stored = sessionStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggle: () =>
    set((state) => {
      const next: ThemeMode = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return { theme: next }
    }),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))
