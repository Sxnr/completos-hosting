// =========================================================
// PLAYIT MANAGER — Gestiona túneles playit por instancia
// =========================================================

import { execSync } from 'child_process'

const FALLBACK_HOST = '172.22.165.77'

const PORT_MAP: Record<number, string> = {
  25565: 'cool-allow.gl.joinmc.link',
  25566: 'environment-sigma.gl.joinmc.link',
  25567: 'hospital-combined.gl.joinmc.link',
  25568: 'thought-almost.gl.joinmc.link',
}

class PlayitManagerClass {
  private tunnels: Map<number, string> = new Map()

  setTunnel(instanceId: number, address: string): void {
    this.tunnels.set(instanceId, address)
  }

  getTunnel(instanceId: number): string | null {
    return this.tunnels.get(instanceId) ?? null
  }

  removeTunnel(instanceId: number): void {
    this.tunnels.delete(instanceId)
  }

  async createTunnel(instanceId: number, port: number): Promise<string> {
    const address = PORT_MAP[port] ?? `${FALLBACK_HOST}:${port}`
    if (instanceId > 0) this.tunnels.set(instanceId, address)
    return address
  }
}

export const playitManager = new PlayitManagerClass()