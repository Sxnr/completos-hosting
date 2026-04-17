// =========================================================
// AUTH SERVICE — Llamadas de autenticación al backend
// =========================================================

import { api } from './api'

interface LoginResponse {
  token: string
  user: {
    id:       number
    username: string
    role:     'admin' | 'viewer'
  }
}

// Llama al endpoint de login y guarda el token en sessionStorage
export const login = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/api/auth/login', {
    username,
    password,
  })

  // Guarda el token y datos del usuario en sesión
  sessionStorage.setItem('token', data.token)
  sessionStorage.setItem('user', JSON.stringify(data.user))

  return data
}

// Elimina la sesión localmente
export const logout = () => {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
}

// Devuelve el usuario guardado en sesión
export const getStoredUser = () => {
  const raw = sessionStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}