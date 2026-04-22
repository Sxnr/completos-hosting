// =========================================================
// PLAYIT MANAGER — Gestiona túneles playit por instancia
// =========================================================

import { execSync } from 'child_process'

const SECRET_KEY = '36ea81100f6d3b3af8036fd78aa62ec55b95a25a5a1a0a07a42c2a2848863792'
const FALLBACK_HOST = '172.22.165.77'

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
    try {
      const result = execSync(
        `playit --secret ${SECRET_KEY} tunnel add --proto tcp --port ${port}`,
        { timeout: 20000, encoding: 'utf8' }
      )
      const match = result.match(/([a-z0-9._-]+\.(?:joinmc|ply\.gg)(?::\d+)?)/i)
      if (match?.[1]) {
        const address = match[1]
        if (instanceId > 0) this.tunnels.set(instanceId, address)
        return address
      }
    } catch (err: any) {
      console.error(`[PlayitManager] Error creando túnel para puerto ${port}:`, err.message)
    }
    // Fallback a IP local
    const fallback = `${FALLBACK_HOST}:${port}`
    if (instanceId > 0) this.tunnels.set(instanceId, fallback)
    return fallback
  }
}

export const playitManager = new PlayitManagerClass()