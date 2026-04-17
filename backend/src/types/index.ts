// =========================================================
// TYPES — Interfaces compartidas del backend
// =========================================================

// Payload que viaja dentro del JWT
export interface JWTPayload {
  id:       number
  username: string
  role:     'admin' | 'viewer'
}

// Usuario en la base de datos
export interface User {
  id:         number
  username:   string
  password:   string   // Hash bcrypt — nunca el texto plano
  role:       'admin' | 'viewer'
  created_at: Date
}

// Respuesta estándar de error de la API
export interface ApiError {
  error:   string
  message: string
  code?:   number
}