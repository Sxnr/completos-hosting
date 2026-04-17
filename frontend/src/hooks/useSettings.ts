// =========================================================
// HOOK — useSettings
// Maneja perfil, cambio de contraseña y gestión de usuarios
// =========================================================

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

export interface UserProfile {
  id:         number
  username:   string
  role:       'admin' | 'viewer'
  created_at: string
}

export function useSettings() {
  const [profile,  setProfile]  = useState<UserProfile | null>(null)
  const [users,    setUsers]    = useState<UserProfile[]>([])
  const [loading,  setLoading]  = useState(true)

  // Carga el perfil del usuario actual
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get<UserProfile>('/api/settings/me')
      setProfile(data)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga lista de usuarios (solo si es admin)
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get<{ users: UserProfile[] }>('/api/settings/users')
      setUsers(data.users)
    } catch { /* viewer no tiene acceso */ }
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchUsers()
  }, [fetchProfile, fetchUsers])

  // Cambiar contraseña del usuario actual
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const { data } = await api.put('/api/settings/password', {
      currentPassword,
      newPassword,
    })
    return data
  }

  // Crear nuevo usuario
  const createUser = async (
    username: string,
    password: string,
    role: 'admin' | 'viewer'
  ) => {
    const { data } = await api.post('/api/settings/users', { username, password, role })
    await fetchUsers()
    return data
  }

  // Eliminar usuario
  const deleteUser = async (id: number) => {
    await api.delete(`/api/settings/users/${id}`)
    await fetchUsers()
  }

  return {
    profile, users, loading,
    changePassword, createUser, deleteUser,
    refetchUsers: fetchUsers,
  }
}