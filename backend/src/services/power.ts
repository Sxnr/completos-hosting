// =========================================================
// POWER SERVICE — Control de encendido/apagado del servidor físico
//   ON : Wake-on-LAN (paquete mágico) al MAC configurado
//   OFF: comando del sistema operativo (poweroff)
// Configurable vía variables de entorno (ver backend/.env.example)
// =========================================================

import dgram from 'dgram'
import { execSync } from 'child_process'
import axios from 'axios'

const DRIVER = (process.env.POWER_DRIVER || 'wol').toLowerCase()

// ── Wake-on-LAN ────────────────────────────────────────────
const WOL_MAC       = process.env.POWER_WOL_MAC || ''
const WOL_BROADCAST = process.env.POWER_WOL_BROADCAST || '255.255.255.255'
const WOL_PORT      = parseInt(process.env.POWER_WOL_PORT || '9')

// ── Apagado del SO ────────────────────────────────────────
const OFF_COMMAND = process.env.POWER_OFF_COMMAND || 'systemctl poweroff'

// ── (Opcional) driver HTTP para dispositivos con API ──────
const HTTP_ON_URL  = process.env.POWER_HTTP_ON_URL  || ''
const HTTP_OFF_URL = process.env.POWER_HTTP_OFF_URL || ''
const HTTP_METHOD  = (process.env.POWER_HTTP_METHOD || 'GET').toUpperCase()
const HTTP_HEADERS = process.env.POWER_HTTP_HEADERS ? JSON.parse(process.env.POWER_HTTP_HEADERS) : {}
const HTTP_BODY    = process.env.POWER_HTTP_BODY    || ''

export interface PowerStatus {
  driver:      string
  enabled:     boolean
  supportsOn:  boolean
  supportsOff: boolean
  offVia:      'os' | 'device'
}

export function getPowerStatus(): PowerStatus {
  return {
    driver: DRIVER,
    enabled: DRIVER !== 'none',
    supportsOn:
      DRIVER === 'wol' ? !!WOL_MAC :
      DRIVER === 'http' ? !!HTTP_ON_URL : false,
    supportsOff:
      DRIVER === 'http' ? !!HTTP_OFF_URL : true,
    offVia: DRIVER === 'http' && HTTP_OFF_URL ? 'device' : 'os',
  }
}

// Construye y envía el paquete mágico WoL
function sendWoL(mac: string, broadcast: string, port: number): void {
  const clean = mac.replace(/[:-]/g, '')
  if (clean.length !== 12 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error(`MAC inválida: ${mac}`)
  }
  const macBytes = Buffer.from(clean, 'hex')
  const packet = Buffer.alloc(102)
  packet.fill(0xff, 0, 6)
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6)

  const socket = dgram.createSocket('udp4')
  socket.send(packet, 0, packet.length, port, broadcast, () => socket.close())
}

// Dispara un endpoint HTTP (dispositivos con API: ESP, Shelly, etc.)
async function httpTrigger(url: string): Promise<void> {
  await axios({
    url,
    method: HTTP_METHOD as any,
    headers: { 'Content-Type': 'application/json', ...HTTP_HEADERS },
    data: HTTP_BODY ? JSON.parse(HTTP_BODY) : undefined,
    timeout: 10000,
  })
}

// ── Encender ──────────────────────────────────────────────
export async function powerOn(): Promise<string> {
  if (DRIVER === 'http') {
    if (!HTTP_ON_URL) throw new Error('POWER_HTTP_ON_URL no configurada')
    await httpTrigger(HTTP_ON_URL)
    return 'Señal de encendido enviada al dispositivo'
  }
  if (DRIVER === 'wol') {
    if (!WOL_MAC) throw new Error('POWER_WOL_MAC no configurada')
    sendWoL(WOL_MAC, WOL_BROADCAST, WOL_PORT)
    return `Paquete Wake-on-LAN enviado a ${WOL_MAC}`
  }
  throw new Error('Control de energía deshabilitado (POWER_DRIVER=none)')
}

// ── Apagar ────────────────────────────────────────────────
export async function powerOff(): Promise<string> {
  if (DRIVER === 'http' && HTTP_OFF_URL) {
    await httpTrigger(HTTP_OFF_URL)
    return 'Señal de apagado enviada al dispositivo'
  }
  // Por defecto (elegido): apagar el sistema operativo del host
  try {
    execSync(OFF_COMMAND, { timeout: 5000 })
    return `Comando de apagado enviado al sistema (${OFF_COMMAND})`
  } catch (e: any) {
    throw new Error(`No se pudo apagar el sistema: ${e.message}`)
  }
}
