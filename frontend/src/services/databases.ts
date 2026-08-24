// =========================================================
// DATABASES SERVICE — Llamadas al módulo de Bases de Datos
// =========================================================

import { api } from './api'

export interface DBInstance {
  id: number
  name: string
  engine: 'postgresql' | 'mariadb' | 'mysql'
  version: string
  port: number
  db_user: string
  db_password: string
  datadir: string
  status: string
  created_by: number | null
}

export const listDatabases = () =>
  api.get<{ instances: DBInstance[] }>('/api/databases').then(r => r.data.instances)

export const createDatabase = (body: { name: string; engine: string; version: string }) =>
  api.post('/api/databases', body).then(r => r.data)

export const deleteDatabase = (id: number) =>
  api.delete(`/api/databases/${id}`).then(r => r.data)

export const startDatabase = (id: number) =>
  api.post(`/api/databases/${id}/start`).then(r => r.data)

export const stopDatabase = (id: number) =>
  api.post(`/api/databases/${id}/stop`).then(r => r.data)

export const restartDatabase = (id: number) =>
  api.post(`/api/databases/${id}/restart`).then(r => r.data)

export const backupDatabase = (id: number, fileName: string) =>
  api.post(`/api/databases/${id}/backup`, { fileName }).then(r => r.data)

export const restoreDatabase = (id: number, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/api/databases/${id}/restore`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const resetDbPassword = (id: number) =>
  api.post(`/api/databases/${id}/password`).then(r => r.data)
