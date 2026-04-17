// =========================================================
// TYPES — Interfaces de procesos y servicios
// =========================================================

export interface ProcessInfo {
  pid:     number
  name:    string
  cpu:     number
  memory:  number
  status:  string
  user:    string
  uptime:  string
}

export interface ServiceInfo {
  name:    string
  status:  'active' | 'inactive' | 'failed' | 'unknown'
  pid?:    number
  uptime?: string
}