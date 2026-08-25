// =========================================================
// BOTS SERVICE — cliente API del módulo de Bots
// =========================================================

import { api } from './api'

export interface Bot {
  id: number
  name: string
  source: 'upload' | 'git'
  repo?: string
  runCommand: string
  autostart: boolean
  createdAt: string
  status?: 'offline' | 'starting' | 'running' | 'stopping' | 'crashed'
  startedAt?: string | null
}

function buildQuery(params: Record<string, string | number | boolean>) {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => usp.set(k, String(v)))
  return usp.toString()
}

export const botsService = {
  async list(): Promise<Bot[]> {
    const { data } = await api.get('/bots')
    return Array.isArray(data?.bots) ? data.bots : []
  },

  async get(id: number): Promise<Bot> {
    const { data } = await api.get(`/bots/${id}`)
    return data
  },

  async create(payload: {
    name: string
    source: 'upload' | 'git'
    repo?: string
    runCommand?: string
    env?: Record<string, string>
    autostart?: boolean
  }): Promise<Bot> {
    const { data } = await api.post('/bots', payload)
    return data.bot
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/bots/${id}`)
  },

  async start(id: number): Promise<void> {
    await api.post(`/bots/${id}/start`)
  },

  async stop(id: number): Promise<void> {
    await api.post(`/bots/${id}/stop`)
  },

  async restart(id: number): Promise<void> {
    await api.post(`/bots/${id}/restart`)
  },

  async pull(id: number): Promise<void> {
    await api.post(`/bots/${id}/pull`)
  },

  async updateEnv(id: number, env: Record<string, string>): Promise<void> {
    await api.put(`/bots/${id}/env`, { env })
  },

  async sendCommand(id: number, command: string): Promise<void> {
    await api.post(`/bots/${id}/command`, { command })
  },

  async console(id: number): Promise<string[]> {
    const { data } = await api.get(`/bots/${id}/console`)
    return data.lines
  },

  consoleWsUrl(id: number): string {
    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    const token = sessionStorage.getItem('token')
    return `${base}/api/bots/${id}/console/ws?token=${token}`
  },

  async listFiles(id: number, dir = ''): Promise<{
    entries: Array<{ name: string; path: string; isDir: boolean; size?: number; mtime?: string }>
    current: string
  }> {
    const { data } = await api.get(`/bots/${id}/files?${buildQuery({ dir })}`)
    return data
  },

  async readFile(id: number, filePath: string): Promise<{ path: string; content: string; isText: boolean }> {
    const { data } = await api.get(`/bots/${id}/file?${buildQuery({ path: filePath })}`)
    return data
  },

  async writeFile(id: number, filePath: string, content: string): Promise<void> {
    await api.put(`/bots/${id}/file`, { path: filePath, content })
  },

  async deletePath(id: number, filePath: string): Promise<void> {
    await api.delete(`/bots/${id}/file?${buildQuery({ path: filePath })}`)
  },

  uploadUrl(id: number): string {
    return `/api/bots/${id}/upload`
  },
}

export default botsService
