// =========================================================
// TYPES — Interfaces de las métricas del servidor
// =========================================================

// Métricas principales del sistema
export interface SystemMetrics {
  cpu: {
    usage: number        // Porcentaje de uso (0-100)
    cores: number        // Número de núcleos
    model: string        // Modelo del procesador
    temp?: number        // Temperatura en °C (opcional)
  }
  ram: {
    used: number         // GB usados
    total: number        // GB totales
    percent: number      // Porcentaje de uso (0-100)
  }
  disk: {
    used: number         // GB usados
    total: number        // GB totales
    percent: number      // Porcentaje de uso (0-100)
  }
  network: {
    rx: number           // MB/s recibidos
    tx: number           // MB/s enviados
  }
  uptime: number         // Segundos desde el último arranque
  hostname: string       // Nombre del servidor
  os: string             // Sistema operativo
  loadAvg: number[]      // Carga promedio [1m, 5m, 15m]
}

// Estado de un servicio o proceso
export interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'warning'
  pid?: number
  memory?: number        // MB usados por el proceso
  uptime?: number        // Segundos activo
}