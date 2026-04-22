// =========================================================
// MINECRAFT MANAGER — Singleton que gestiona todas las
// instancias. Punto de entrada para el resto del backend.
// =========================================================

import path from 'path'
import fs   from 'fs'
import axios from 'axios'
import type { Pool } from 'pg'
import { MinecraftInstance, type InstanceStatus } from './MinecraftInstance'
import { MC_CONFIG } from '../config/minecraft'
import { playitManager } from '../services/PlayitManager'

interface InstanceRow {
  id:            number
  name:          string
  description:   string | null
  software:      string
  version:       string
  edition:       string
  port:          number
  last_status:   string
  ram_mb:        number
  java_flags:    string
  folder_name:   string
  properties:    Record<string, unknown>
  created_at:    string
  updated_at:    string
  tunnel_address?: string
}

export class MinecraftManager {
  private db:               Pool
  private instances:        Map<number, MinecraftInstance> = new Map()
  private downloadProgress: Map<string, {
    percent: number
    status:  'downloading' | 'done' | 'error'
    message: string
  }> = new Map()

  constructor(db: Pool) {
    this.db = db
  }

  // ── Inicializar ───────────────────────────────────────
  async init(): Promise<void> {
    fs.mkdirSync(MC_CONFIG.serversDir, { recursive: true })
    fs.mkdirSync(MC_CONFIG.jarsDir,    { recursive: true })

    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances ORDER BY id ASC'
    )

    for (const row of rows) {
      const instance = new MinecraftInstance(row.id, row.folder_name)
      this.instances.set(row.id, instance)
      // Restaurar túnel en memoria si existe en DB
      if (row.tunnel_address) {
        playitManager.setTunnel(row.id, row.tunnel_address)
      }
    }

    console.log(`✅ MinecraftManager: ${rows.length} instancias cargadas`)
  }

  // ── CRUD ──────────────────────────────────────────────

  async createInstance(opts: {
    name:         string
    description?: string
    software:     string
    version:      string
    edition:      string
    port?:        number
    ramMb?:       number
    createdBy?:   number
  }): Promise<InstanceRow & { tunnel_address: string }> {
    const folderName = opts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now()

    const port = opts.port || await this._nextAvailablePort()

    const properties = {
      ...MC_CONFIG.defaultProperties,
      'server-port': port,
    }

    // Crear túnel playit para este puerto
    const tunnelAddress = await playitManager.createTunnel(
      -1, // ID temporal, se actualiza después
      port
    )

    const { rows } = await this.db.query<InstanceRow>(
      `INSERT INTO minecraft_instances
        (name, description, software, version, edition, port, ram_mb, folder_name, properties, created_by, tunnel_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        opts.name,
        opts.description || null,
        opts.software,
        opts.version,
        opts.edition,
        port,
        opts.ramMb || 1024,
        folderName,
        JSON.stringify(properties),
        opts.createdBy || null,
        tunnelAddress,
      ]
    )

    const row = rows[0]

    // Actualizar el túnel con el ID real
    playitManager.setTunnel(row.id, tunnelAddress)

    const instanceDir = path.join(MC_CONFIG.serversDir, folderName)
    fs.mkdirSync(instanceDir, { recursive: true })
    this._writeServerProperties(instanceDir, properties)

    const instance = new MinecraftInstance(row.id, folderName)
    this.instances.set(row.id, instance)

    return { ...row, tunnel_address: tunnelAddress }
  }

  async deleteInstance(id: number): Promise<void> {
    const instance = this.instances.get(id)
    if (instance?.isRunning) await instance.stop()

    const { rows } = await this.db.query<{ folder_name: string }>(
      'SELECT folder_name FROM minecraft_instances WHERE id = $1',
      [id]
    )

    if (rows[0]) {
      const folderPath = path.join(MC_CONFIG.serversDir, rows[0].folder_name)
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true })
      }
    }

    await this.db.query('DELETE FROM minecraft_instances WHERE id = $1', [id])
    this.instances.delete(id)
    playitManager.removeTunnel(id)
  }

  async getInstance(id: number): Promise<InstanceRow | null> {
    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances WHERE id = $1',
      [id]
    )
    return rows[0] || null
  }

  async listInstances(): Promise<(InstanceRow & {
    status:         InstanceStatus
    playerCount:    number
    players:        string[]
    tunnel_address: string
  })[]> {
    const { rows } = await this.db.query<InstanceRow>(
      'SELECT * FROM minecraft_instances ORDER BY created_at DESC'
    )

    return rows.map(row => {
      const instance = this.instances.get(row.id)
      return {
        ...row,
        status:         instance?.status      || 'offline',
        playerCount:    instance?.playerCount || 0,
        players:        instance?.players     || [],
        tunnel_address: playitManager.getTunnel(row.id) ?? row.tunnel_address ?? `172.22.165.77:${row.port}`,
      }
    })
  }

  // ── Start / Stop / Restart ────────────────────────────

  async startInstance(id: number): Promise<void> {
    const instance = this.getInstance_mem(id)
    const row      = await this.getInstance(id)
    if (!row) throw new Error(`Instancia ${id} no encontrada`)

    const jarInInstance = path.join(MC_CONFIG.serversDir, row.folder_name, 'server.jar')
    const jarInCache    = path.join(MC_CONFIG.jarsDir, row.software, `${row.version}.jar`)

    let jarFile: string

    if (fs.existsSync(jarInInstance)) {
      jarFile = jarInInstance
    } else if (fs.existsSync(jarInCache)) {
      fs.copyFileSync(jarInCache, jarInInstance)
      jarFile = jarInInstance
    } else {
      this.downloadJar(row.software, row.version)
        .catch(err => console.error(`Error descargando JAR: ${err.message}`))

      throw Object.assign(
        new Error(`JAR no encontrado. Descargando ${row.software} ${row.version}...`),
        { code: 'JAR_DOWNLOADING' }
      )
    }

    await instance.start({
      jarFile,
      ramMb:     row.ram_mb,
      javaFlags: row.java_flags || '',
    })

    await this.db.query(
      "UPDATE minecraft_instances SET last_status = 'online' WHERE id = $1",
      [id]
    )
  }

  async stopInstance(id: number): Promise<void> {
    const instance = this.getInstance_mem(id)
    await instance.stop()
    await this.db.query(
      "UPDATE minecraft_instances SET last_status = 'offline' WHERE id = $1",
      [id]
    )
  }

  async restartInstance(id: number): Promise<void> {
    await this.stopInstance(id)
    await this.startInstance(id)
  }

  // ── Acceso en memoria ─────────────────────────────────

  getInstance_mem(id: number): MinecraftInstance {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Instancia ${id} no encontrada en memoria`)
    return instance
  }

  // ── Progreso de descarga ──────────────────────────────

  getDownloadProgress(software: string, version: string) {
    return this.downloadProgress.get(`${software}-${version}`) ?? null
  }

  // ── Descarga de JARs ──────────────────────────────────

  async downloadJar(software: string, version: string): Promise<string> {
    const key      = `${software}-${version}`
    const destDir  = path.join(MC_CONFIG.jarsDir, software)
    const destPath = path.join(destDir, `${version}.jar`)

    if (fs.existsSync(destPath)) {
      this.downloadProgress.set(key, { percent: 100, status: 'done', message: 'JAR ya disponible en caché' })
      return destPath
    }

    fs.mkdirSync(destDir, { recursive: true })
    this.downloadProgress.set(key, { percent: 0, status: 'downloading', message: 'Obteniendo URL de descarga...' })

    try {
      const url = await this._getDownloadUrl(software, version)
      this.downloadProgress.set(key, { percent: 5, status: 'downloading', message: `Descargando ${software} ${version}...` })

      const response = await axios.get(url, {
        responseType: 'stream',
        timeout:      180_000,
      })

      const totalLength = parseInt(response.headers['content-length'] ?? '0', 10)
      let downloaded = 0

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(destPath)

        response.data.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (totalLength > 0) {
            const percent = Math.round((downloaded / totalLength) * 95) + 5
            this.downloadProgress.set(key, {
              percent,
              status:  'downloading',
              message: `Descargando... ${formatBytes(downloaded)} / ${formatBytes(totalLength)}`,
            })
          }
        })

        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error',  reject)
      })

      this.downloadProgress.set(key, { percent: 100, status: 'done', message: '¡JAR descargado correctamente!' })
      return destPath

    } catch (err: any) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
      this.downloadProgress.set(key, { percent: 0, status: 'error', message: err.message })
      throw err
    }
  }

  // ── Privados ──────────────────────────────────────────

  private async _nextAvailablePort(): Promise<number> {
    const { rows } = await this.db.query<{ port: number }>(
      'SELECT port FROM minecraft_instances ORDER BY port ASC'
    )
    const usedPorts = new Set(rows.map(r => r.port))
    let port = MC_CONFIG.basePort
    while (usedPorts.has(port)) port++
    return port
  }

  private _writeServerProperties(dir: string, props: Record<string, unknown>): void {
    const lines = [
      '#Minecraft server properties',
      '#Generated by ServerOS Dashboard',
      '',
      ...Object.entries(props).map(([k, v]) => `${k}=${v}`),
    ]
    fs.writeFileSync(path.join(dir, 'server.properties'), lines.join('\n'))
  }

  private async _getDownloadUrl(software: string, version: string): Promise<string> {
    switch (software) {
      case 'vanilla': {
        const manifest = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')
        const ver = manifest.data.versions.find((v: any) => v.id === version)
        if (!ver) throw new Error(`Versión vanilla ${version} no encontrada`)
        const verMeta = await axios.get(ver.url)
        return verMeta.data.downloads.server.url
      }

      case 'paper': {
        const buildsRes = await axios.get(
          `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`
        )
        const builds: any[] = buildsRes.data.builds
        const latest        = builds[builds.length - 1]
        const fileName      = latest.downloads.application.name
        return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latest.build}/downloads/${fileName}`
      }

      case 'purpur':
        return `https://api.purpurmc.org/v2/purpur/${version}/latest/download`

      case 'fabric': {
        const loaderRes       = await axios.get('https://meta.fabricmc.net/v2/versions/loader')
        const latestLoader    = loaderRes.data[0].version
        const installerRes    = await axios.get('https://meta.fabricmc.net/v2/versions/installer')
        const latestInstaller = installerRes.data[0].version
        return `https://meta.fabricmc.net/v2/versions/loader/${version}/${latestLoader}/${latestInstaller}/server/jar`
      }

      default:
        throw new Error(`Descarga automática no soportada para ${software}. Sube el JAR manualmente.`)
    }
  }
}

function formatBytes(b: number): string {
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}