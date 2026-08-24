// =========================================================
// WEB SERVICE — Llamadas al módulo de Web Hosting
// =========================================================

import { api } from './api'

export interface WebSite {
  id: number
  name: string
  root_dir: string
  php_enabled: boolean
  php_version: string | null
  fpm_port: number | null
  ssl: boolean
  status: string
  created_by: number | null
}

export interface FileEntry {
  name: string
  isDir: boolean
  size: number | null
  modified: string
}

export const listSites = () =>
  api.get<{ sites: WebSite[] }>('/api/web').then(r => r.data.sites)

export const createSite = (body: { name: string; phpEnabled?: boolean; phpVersion?: string; ssl?: boolean }) =>
  api.post('/api/web', body).then(r => r.data)

export const deleteSite = (id: number) =>
  api.delete(`/api/web/${id}`).then(r => r.data)

export const startSite = (id: number) =>
  api.post(`/api/web/${id}/start`).then(r => r.data)

export const stopSite = (id: number) =>
  api.post(`/api/web/${id}/stop`).then(r => r.data)

export const listFiles = (id: number, dir = '') =>
  api.get<{ path: string; files: FileEntry[] }>(`/api/web/${id}/files`, { params: { dir } }).then(r => r.data)

export const readFile = (id: number, path: string) =>
  api.get<{ path: string; content: string }>(`/api/web/${id}/file`, { params: { path } }).then(r => r.data)

export const writeFile = (id: number, path: string, content: string) =>
  api.put(`/api/web/${id}/file`, { path, content }).then(r => r.data)

export const deleteFile = (id: number, path: string) =>
  api.delete(`/api/web/${id}/file`, { params: { path } }).then(r => r.data)

export const uploadFile = (id: number, path: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  ;(fd as any).append('path', path)
  return api.post(`/api/web/${id}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
