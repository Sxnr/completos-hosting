// =========================================================
// API SERVICE — Cliente HTTP centralizado
// Todas las llamadas al backend pasan por aquí
// =========================================================

import axios from 'axios'

// URL base del backend — en desarrollo apunta a localhost
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Instancia de axios con configuración base
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de requests ───────────────────────────────
// Agrega el token JWT automáticamente a cada request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de responses ──────────────────────────────
// Si el backend devuelve 401, limpia la sesión y redirige al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      // Redirige al login sin usar React Router (funciona desde cualquier contexto)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)