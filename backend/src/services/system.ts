// =========================================================
// SYSTEM SERVICE — Lee métricas reales del sistema operativo
// Usa el módulo nativo 'os' de Node.js + lectura de /proc
// =========================================================

import os from 'os'
import { readFile } from 'fs/promises'

// ── CPU ──────────────────────────────────────────────────

// Lee el uso de CPU comparando dos snapshots de /proc/stat
// Node os.cpus() solo da valores acumulados, hay que calcular la diferencia
const getCpuUsage = (): Promise<number> => {
  return new Promise(resolve => {
    const cpus1 = os.cpus()

    // Espera 200ms y toma otro snapshot para calcular la diferencia
    setTimeout(() => {
      const cpus2 = os.cpus()
      let idle = 0, total = 0

      for (let i = 0; i < cpus1.length; i++) {
        const t1 = Object.values(cpus1[i].times).reduce((a, b) => a + b, 0)
        const t2 = Object.values(cpus2[i].times).reduce((a, b) => a + b, 0)
        idle  += cpus2[i].times.idle  - cpus1[i].times.idle
        total += t2 - t1
      }

      // Porcentaje de uso = (1 - idle/total) * 100
      const usage = total > 0 ? Math.round((1 - idle / total) * 100) : 0
      resolve(usage)
    }, 200)
  })
}

// ── Temperatura CPU (Linux — lectura de /sys) ────────────
const getCpuTemp = async (): Promise<number | undefined> => {
  try {
    // Ruta estándar de temperatura en Linux
    const raw = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8')
    // El archivo devuelve la temperatura en miligrados (ej: 45000 = 45°C)
    return Math.round(parseInt(raw.trim()) / 1000)
  } catch {
    // Si no existe el archivo (algunos VPS no lo exponen), retorna undefined
    return undefined
  }
}

// ── Métricas completas del sistema ───────────────────────
export const getSystemMetrics = async () => {
  const [cpuUsage, cpuTemp] = await Promise.all([getCpuUsage(), getCpuTemp()])

  const totalMem = os.totalmem()
  const freeMem  = os.freemem()
  const usedMem  = totalMem - freeMem

  // Convierte bytes a GB con 2 decimales
  const toGB = (bytes: number) => Math.round((bytes / 1024 ** 3) * 100) / 100

  return {
    cpu: {
      usage:  cpuUsage,
      cores:  os.cpus().length,
      model:  os.cpus()[0]?.model?.trim() || 'Unknown',
      temp:   cpuTemp,
    },
    ram: {
      used:    toGB(usedMem),
      total:   toGB(totalMem),
      percent: Math.round((usedMem / totalMem) * 100),
    },
    network: getNetworkStats(),
    uptime:  Math.floor(os.uptime()),
    hostname: os.hostname(),
    os:      `${os.type()} ${os.release()}`,
    loadAvg: os.loadavg().map(n => Math.round(n * 100) / 100),
  }
}

// ── Red — suma de todas las interfaces activas ───────────
const prevNet: Record<string, { rx: number, tx: number, time: number }> = {}

const getNetworkStats = () => {
  // os.networkInterfaces() no da velocidad, solo datos acumulados
  // Calculamos MB/s comparando con la lectura anterior
  const ifaces = os.networkInterfaces()
  let rx = 0, tx = 0

  // Por simplicidad retornamos 0 aquí
  // En el WebSocket lo calculamos con dos lecturas de /proc/net/dev
  return { rx, tx }
}

// ── Disco — lectura de /proc/mounts o df ─────────────────
export const getDiskUsage = async () => {
  try {
    // Ejecutamos df para obtener uso del disco raíz
    const { execSync } = await import('child_process')
    const output = execSync("df -BGB / | tail -1").toString().trim()
    const parts  = output.split(/\s+/)

    // df devuelve: filesystem, size, used, avail, use%, mountpoint
    const total   = parseInt(parts[1])
    const used    = parseInt(parts[2])
    const percent = parseInt(parts[4])

    return { used, total, percent }
  } catch {
    // Fallback si df no está disponible
    return { used: 0, total: 0, percent: 0 }
  }
}