// =========================================================
// PROCESSES SERVICE — Lee procesos activos del sistema
// Usa /proc en Linux para obtener datos sin dependencias
// =========================================================

import { execSync } from 'child_process'

export interface ProcessInfo {
  pid:     number
  name:    string
  cpu:     number    // % de CPU
  memory:  number    // MB de RAM usados
  status:  string    // R=running, S=sleeping, Z=zombie, etc.
  user:    string    // Usuario que lo ejecuta
  uptime:  string    // Tiempo activo formateado
}

export interface ServiceInfo {
  name:    string
  status:  'active' | 'inactive' | 'failed' | 'unknown'
  pid?:    number
  uptime?: string
}

// ── Top procesos por uso de CPU ───────────────────────────
export const getTopProcesses = (limit = 15): ProcessInfo[] => {
  try {
    // ps axo: todos los procesos con formato personalizado
    // --sort=-%cpu: ordena de mayor a menor uso de CPU
    const output = execSync(
      `ps axo pid,comm,%cpu,%mem,stat,user,etime --sort=-%cpu --no-headers | head -${limit}`,
      { timeout: 5000 }
    ).toString().trim()

    if (!output) return []

    return output.split('\n').map(line => {
      const parts = line.trim().split(/\s+/)
      const memPercent = parseFloat(parts[3]) || 0
      const totalMemMB = require('os').totalmem() / 1024 / 1024

      return {
        pid:    parseInt(parts[0]),
        name:   parts[1]?.substring(0, 30) || 'unknown',
        cpu:    parseFloat(parts[2]) || 0,
        memory: Math.round((memPercent / 100) * totalMemMB),
        status: parts[4] || '?',
        user:   parts[5]?.substring(0, 15) || 'unknown',
        uptime: parts[6] || '—',
      }
    }).filter(p => !isNaN(p.pid))

  } catch {
    return []
  }
}

// ── Estado de servicios clave del sistema ────────────────
// Lista de servicios que nos interesan monitorear
const WATCHED_SERVICES = [
  'nginx',
  'postgresql',
  'pm2',
  'ssh',
  'ufw',
  'fail2ban',
]

export const getServiceStatus = (): ServiceInfo[] => {
  return WATCHED_SERVICES.map(name => {
    try {
      // systemctl is-active devuelve "active", "inactive", "failed"
      const status = execSync(
        `systemctl is-active ${name} 2>/dev/null || echo inactive`,
        { timeout: 3000 }
      ).toString().trim() as ServiceInfo['status']

      // Si está activo, obtener el PID principal
      let pid: number | undefined
      if (status === 'active') {
        try {
          const pidStr = execSync(
            `systemctl show ${name} --property=MainPID --value 2>/dev/null`,
            { timeout: 2000 }
          ).toString().trim()
          pid = parseInt(pidStr) || undefined
        } catch { /* sin PID */ }
      }

      return { name, status, pid }
    } catch {
      return { name, status: 'unknown' }
    }
  })
}