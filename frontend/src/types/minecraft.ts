// =========================================================
// TYPES — Interfaces del módulo Minecraft
// =========================================================

export type InstanceStatus =
  | 'offline'
  | 'starting'
  | 'online'
  | 'stopping'

export type Edition = 'java' | 'bedrock'

export interface MinecraftInstance {
  id:          number
  name:        string
  description: string | null
  software:    string
  version:     string
  edition:     Edition
  port:        number
  last_status: InstanceStatus
  ram_mb:      number
  java_flags:  string
  folder_name: string
  properties:  Record<string, unknown>
  created_at:  string
  updated_at:  string

  // Runtime — solo cuando viene del endpoint enriquecido
  status?:      InstanceStatus
  playerCount?: number
  players?:     string[]
}

export interface SoftwareOption {
  id:         string
  label:      string
  hasPlugins: boolean
  hasMods:    boolean
}

export interface ConsoleLine {
  timestamp: string
  level:     'INFO' | 'WARN' | 'ERROR' | 'UNKNOWN'
  text:      string
  raw:       string
}

export interface MinecraftBackup {
  id:           number
  instance_id:  number
  filename:     string
  size_bytes:   number
  created_at:   string
  drive_file_id: string | null
  drive_url:    string | null
}