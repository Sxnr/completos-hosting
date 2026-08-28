// =========================================================
// BOT MANAGER — Supervisor de procesos para bots 24/7
// - Spawn del proceso con child_process (shell)
// - Autoreinicio en crash con backoff + protección anti bucle
// - Buffer de consola + EventEmitter por bot (consola WS)
// - File manager (listar/leer/escribir/subir) dentro del bot
// - Persistencia de metadata en JSON (sin migración de DB)
// =========================================================

import { EventEmitter } from 'events'
import { spawn, execSync, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { BOT_CONFIG } from '../config/bots'

export type BotStatus =
  | 'offline' | 'starting' | 'online' | 'stopping' | 'crashed' | 'installing'

export interface BotMeta {
  id: number
  name: string
  source: 'upload' | 'git'
  repo?: string
  runCommand: string
  autostart: boolean
  createdAt: string
  // env NO se serializa en las listas (se mantiene en el servidor)
  env?: Record<string, string>
}

interface BotRuntime extends EventEmitter {
  proc: ChildProcess | null
  status: BotStatus
  consoleLog: string[]
  stopRequested: boolean
  restartCount: number
  restartsAt: number[]
  startedAt: number | null
}

function safeResolve(baseDir: string, subPath = ''): string {
  const resolved = path.resolve(baseDir, subPath)
  const normalizedBase = path.resolve(baseDir)
  if (!resolved.startsWith(normalizedBase)) throw new Error('Path no permitido')
  return resolved
}

function isTextFile(filePath: string): boolean {
  return /\.(txt|properties|json|yml|yaml|toml|cfg|conf|ini|log|xml|csv|env|mcmeta|js|ts|py|md|lock|gitignore|gitattributes)$/i.test(
    filePath,
  )
}

export class BotManager {
  private metas = new Map<number, BotMeta>()
  private runtimes = new Map<number, BotRuntime>()
  private nextId = 1
  private dataFile: string

  constructor(private baseDir: string) {
    this.dataFile = path.join(baseDir, 'bots.json')
  }

  // ── Init ──────────────────────────────────────────────
  async init(): Promise<void> {
    fs.mkdirSync(this.baseDir, { recursive: true })
    this.reload()
  }

  // Recarga los metas desde bots.json (fuente de verdad en disco)
  reload(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'))
        this.metas = new Map(data.metas ?? [])
        this.nextId = data.nextId ?? this.metas.size + 1
      }
    } catch (err) {
      console.error('[BotManager] No se pudo cargar bots.json:', err)
    }
  }

  private save(): void {
    const data = {
      nextId: this.nextId,
      metas: Array.from(this.metas.entries()),
    }
    fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2))
  }

  // ── Listado (sin env por seguridad) ───────────────────
  listBots(): Array<BotMeta & { status: BotStatus; startedAt: number | null }> {
    this.reload()
    return Array.from(this.metas.values()).map((m) => {
      const rt = this.runtimes.get(m.id)
      return {
        ...m,
        status: rt?.status ?? 'offline',
        startedAt: rt?.startedAt ?? null,
      }
    })
  }

  getMeta(id: number): BotMeta | undefined {
    let m = this.metas.get(id)
    if (!m) {
      this.reload()
      m = this.metas.get(id)
    }
    return m
  }

  getBotDir(id: number): string {
    const meta = this.getMeta(id)
    if (!meta) throw new Error('Bot no encontrado')
    return path.join(this.baseDir, `bot_${id}`)
  }

  getRuntime(id: number): BotRuntime | undefined {
    return this.runtimes.get(id)
  }

  // ── Crear ─────────────────────────────────────────────
  async createBot(input: {
    name: string
    source: 'upload' | 'git'
    repo?: string
    runCommand?: string
    env?: Record<string, string>
    autostart?: boolean
  }): Promise<BotMeta> {
    const id = this.nextId++
    const meta: BotMeta = {
      id,
      name: input.name,
      source: input.source,
      repo: input.repo,
      runCommand: input.runCommand || BOT_CONFIG.defaultRunCommand,
      autostart: input.autostart ?? true,
      createdAt: new Date().toISOString(),
      env: input.env || {},
    }

    const botDir = path.join(this.baseDir, `bot_${id}`)

    // Si es git, clona el repo directo a la carpeta destino (git crea la carpeta)
    if (meta.source === 'git' && meta.repo) {
      try {
        execSync(`git clone --depth 1 "${meta.repo}" "${botDir}"`, {
          stdio: 'pipe',
        })
      } catch (err: any) {
        // Limpia y propaga con el detalle real
        fs.rmSync(botDir, { recursive: true, force: true })
        const detail = err?.stderr?.toString() || err?.stdout?.toString() || err?.message || ''
        throw new Error(`Error clonando repo: ${detail}`.trim())
      }
    } else {
      fs.mkdirSync(botDir, { recursive: true })
    }

    // Guarda el .env en el servidor (no se expone al frontend)
    if (meta.env && Object.keys(meta.env).length > 0) {
      this.writeEnv(botDir, meta.env)
    }

    this.metas.set(id, meta)
    this.save()

    // Si es git, instala dependencias de inmediato (visible en la consola)
    if (meta.source === 'git') {
      const rt = this.ensureRuntime(id)
      try {
        await this.installDeps(id, rt)
      } catch (err: any) {
        rt.emit('console', `[Error] npm install falló: ${err.message}`)
      }
    }

    return meta
  }

  private writeEnv(botDir: string, env: Record<string, string>): void {
    const content = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    fs.writeFileSync(path.join(botDir, '.env'), content)
  }

  // ── Eliminar ──────────────────────────────────────────
  async deleteBot(id: number): Promise<void> {
    this.stopBot(id)
    const botDir = this.getBotDir(id)
    fs.rmSync(botDir, { recursive: true, force: true })
    this.metas.delete(id)
    this.runtimes.delete(id)
    this.save()
  }

  // ── Ejecuta un comando auxiliar y envía su salida a la consola ──
  private spawnCmd(id: number, cmd: string, args: string[], rt?: BotRuntime): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = this.getBotDir(id)
      const child = spawn(cmd, args, { cwd: dir, shell: true, env: process.env })
      const sink = (d: Buffer) => {
        const t = rt ?? this.runtimes.get(id)
        t?.emit('console', d.toString())
      }
      child.stdout?.on('data', sink)
      child.stderr?.on('data', sink)
      child.on('error', (e) => reject(e))
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} salió con código ${code}`)),
      )
    })
  }

  // Instala dependencias (npm install) mostrando salida en la consola
  private async installDeps(id: number, rt?: BotRuntime): Promise<void> {
    const t = rt ?? this.runtimes.get(id)
    t?.emit('console', '[Sistema] Instalando dependencias (npm install)...')
    await this.spawnCmd(id, 'npm', ['install', '--no-audit', '--no-fund', '--omit=dev'], t)
    t?.emit('console', '[Sistema] Dependencias instaladas.')
  }

  // Registra los slash commands si el package.json tiene script "deploy" (una vez)
  private async maybeDeploy(id: number, rt?: BotRuntime): Promise<void> {
    const dir = this.getBotDir(id)
    const pkgPath = path.join(dir, 'package.json')
    if (!fs.existsSync(pkgPath)) return
    let pkg: any
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) } catch { return }
    if (!pkg?.scripts?.deploy) return
    const marker = path.join(dir, '.deployed_commands')
    if (fs.existsSync(marker)) return
    const t = rt ?? this.runtimes.get(id)
    t?.emit('console', '[Sistema] Registrando slash commands (npm run deploy)...')
    await this.spawnCmd(id, 'npm', ['run', 'deploy'], t)
    fs.writeFileSync(marker, new Date().toISOString())
  }

  // ── Start (supervisado) ──────────────────────────────
  startBot(id: number): void {
    const meta = this.metas.get(id)
    if (!meta) throw new Error('Bot no encontrado')
    const rt = this.ensureRuntime(id)
    if (rt.proc && rt.status === 'online') return
    rt.stopRequested = false
    this.pushLog(id, `[${meta.name}] [Panel] Iniciando bot...`)
    // Preparación asíncrona (instalar deps + deploy) y luego lanza
    void this.prepareAndStart(id)
  }

  private async prepareAndStart(id: number): Promise<void> {
    const rt = this.runtimes.get(id)
    if (!rt) return
    const meta = this.metas.get(id)
    if (!meta) return
    const botDir = this.getBotDir(id)

    if (!fs.existsSync(botDir)) {
      rt.status = 'crashed'
      rt.emit('status', rt.status)
      rt.emit('console', '[Error] El directorio del bot no existe.')
      return
    }

    if (!fs.existsSync(path.join(botDir, 'node_modules'))) {
      rt.status = 'installing'
      rt.emit('status', rt.status)
      try {
        await this.installDeps(id, rt)
      } catch (err: any) {
        rt.status = 'crashed'
        rt.emit('status', rt.status)
        rt.emit('console', `[Error] Falló npm install: ${err.message}`)
        return
      }
    }

    try {
      await this.maybeDeploy(id, rt)
    } catch (err: any) {
      rt.emit('console', `[Aviso] No se pudo registrar comandos: ${err.message}`)
    }

    this.launch(id)
  }

  private launch(id: number): void {
    const meta = this.metas.get(id)
    const rt = this.runtimes.get(id)
    if (!meta || !rt) return

    rt.status = 'starting'
    rt.startedAt = Date.now()
    rt.emit('status', rt.status)

    const botDir = this.getBotDir(id)
    const env = { ...process.env, ...(meta.env || {}) }

    let proc: ChildProcess
    try {
      proc = spawn(meta.runCommand, {
        cwd: botDir,
        env,
        shell: true,
        detached: true,
      })
    } catch (err: any) {
      rt.status = 'crashed'
      rt.emit('status', rt.status)
      rt.emit('console', `[Error] No se pudo iniciar: ${err.message}`)
      return
    }

    rt.proc = proc
    const tag = `[${meta.name}]`
    proc.stdout?.on('data', (d) => this.pushLog(id, `${tag} ${d.toString().trim()}`))
    proc.stderr?.on('data', (d) => this.pushLog(id, `${tag} ${d.toString().trim()}`))

    proc.on('spawn', () => {
      rt.status = 'online'
      rt.emit('status', rt.status)
      this.pushLog(id, `${tag} Proceso iniciado.`)
    })

    proc.on('exit', (code, signal) => {
      rt.proc = null
      if (rt.stopRequested) {
        rt.status = 'offline'
        rt.emit('status', rt.status)
        this.pushLog(id, `${tag} Detenido.`)
        return
      }
      // Crash → reinicio con backoff + protección anti bucle
      this.pushLog(id, `${tag} Salió (code=${code ?? signal}). Reiniciando...`)
      const now = Date.now()
      rt.restartsAt = rt.restartsAt.filter((t) => now - t < BOT_CONFIG.crashLoopWindowMs)
      rt.restartsAt.push(now)
      if (rt.restartsAt.length > BOT_CONFIG.crashLoopMaxRestarts) {
        rt.status = 'crashed'
        rt.emit('status', rt.status)
        this.pushLog(id, `${tag} Demasiados reinicios seguidos (crash loop). Revisa los logs.`)
        return
      }
      const delay = BOT_CONFIG.restartBackoffBaseMs * rt.restartsAt.length
      setTimeout(() => {
        if (!rt.stopRequested) this.startBot(id)
      }, delay)
    })
  }

  private ensureRuntime(id: number): BotRuntime {
    let rt = this.runtimes.get(id)
    if (!rt) {
      rt = new EventEmitter() as BotRuntime
      rt.proc = null
      rt.status = 'offline'
      rt.consoleLog = []
      rt.stopRequested = false
      rt.restartCount = 0
      rt.restartsAt = []
      rt.startedAt = null
      this.runtimes.set(id, rt)
    }
    return rt
  }

  private pushLog(id: number, line: string): void {
    const rt = this.runtimes.get(id)
    if (!rt) return
    rt.consoleLog.push(line)
    if (rt.consoleLog.length > BOT_CONFIG.logRetention) {
      rt.consoleLog = rt.consoleLog.slice(-BOT_CONFIG.logRetention)
    }
    rt.emit('console', line)
  }

  getConsole(id: number): string[] {
    return this.runtimes.get(id)?.consoleLog ?? []
  }

  // Mata el proceso y todo su árbol hijo (grupo de procesos)
  private killTree(proc: ChildProcess, signal: NodeJS.Signals): void {
    if (!proc.pid) return
    try {
      // El bot corre con detached:true, así que su pid es el líder del grupo.
      // Matar -pid mata el shell Y el node hijo (Discord) de una vez.
      process.kill(-proc.pid, signal)
    } catch {
      try { proc.kill(signal) } catch {}
    }
  }

  // ── Stop ──────────────────────────────────────────────
  stopBot(id: number): void {
    const rt = this.runtimes.get(id)
    if (!rt) return
    const name = this.metas.get(id)?.name ?? `bot_${id}`
    rt.stopRequested = true
    rt.status = 'stopping'
    rt.emit('status', rt.status)
    this.pushLog(id, `[${name}] [Panel] Apagando bot...`)
    const target = rt.proc
    if (target?.pid) {
      this.killTree(target, 'SIGTERM')
      // Fuerza a los pocos segundos si no terminó (usamos el proc capturado,
      // no rt.proc, para no matar un proceso nuevo si se reinicia entretanto)
      setTimeout(() => {
        try { this.killTree(target, 'SIGKILL') } catch {}
      }, 5000)
    } else {
      rt.status = 'offline'
      rt.emit('status', rt.status)
    }
  }

  restartBot(id: number): void {
    const name = this.metas.get(id)?.name ?? `bot_${id}`
    this.pushLog(id, `[${name}] [Panel] Reiniciando bot...`)
    this.stopBot(id)
    setTimeout(() => this.startBot(id), 1500)
  }

  sendCommand(id: number, command: string): void {
    const rt = this.runtimes.get(id)
    if (rt?.proc?.stdin) {
      try {
        rt.proc.stdin.write(command + '\n')
        this.pushLog(id, `> ${command}`)
      } catch {}
    }
  }

  // ── Git pull (solo fuente git) ───────────────────────
  pullRepo(id: number): void {
    const meta = this.metas.get(id)
    if (meta?.source !== 'git') throw new Error('El bot no es de origen git')
    const botDir = this.getBotDir(id)
    this.pushLog(id, `[${meta.name}] [Panel] Ejecutando git pull del repositorio...`)
    try {
      const out = execSync('git pull', { cwd: botDir, stdio: 'pipe' }).toString().trim()
      this.pushLog(id, `[${meta.name}] git pull:\n${out || '(sin cambios)'}`)
    } catch (err: any) {
      const detail = err?.stderr?.toString() || err?.stdout?.toString() || err?.message || ''
      this.pushLog(id, `[${meta.name}] [Error] git pull falló:\n${detail}`)
      throw err
    }
  }

  private parseEnvFile(filePath: string): Record<string, string> {
    const out: Record<string, string> = {}
    if (!fs.existsSync(filePath)) return out
    for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx === -1) continue
      out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return out
  }

  // Devuelve el contenido crudo del .env (para edición directa)
  getEnvRaw(id: number): string {
    const meta = this.getMeta(id)
    if (!meta) throw new Error('Bot no encontrado')
    const p = path.join(this.getBotDir(id), '.env')
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
  }

  // Guarda el .env directamente desde el editor crudo
  updateEnv(id: number, content: string): void {
    const meta = this.getMeta(id)
    if (!meta) throw new Error('Bot no encontrado')
    const dir = this.getBotDir(id)
    fs.writeFileSync(path.join(dir, '.env'), content ?? '')
    meta.env = this.parseEnvFile(path.join(dir, '.env'))
    this.save()
  }

  // ── Autostart al arrancar el backend ─────────────────
  autoStartAll(): void {
    for (const meta of this.metas.values()) {
      if (meta.autostart) {
        try { this.startBot(meta.id) } catch (err: any) {
          console.error(`[BotManager] No se pudo autostart bot ${meta.id}:`, err.message)
        }
      }
    }
  }

  // Detiene todos los bots (al apagar el backend, evita huérfanos)
  stopAll(): void {
    for (const rt of this.runtimes.values()) {
      if (rt.proc?.pid) {
        try { this.killTree(rt.proc, 'SIGTERM') } catch {}
      }
    }
  }

  // ── File manager ─────────────────────────────────────
  listFiles(id: number, dir = ''): { entries: Array<{ name: string; path: string; isDir: boolean; size?: number; mtime?: string }>; current: string } {
    const baseDir = this.getBotDir(id)
    const target = safeResolve(baseDir, dir)
    if (!fs.existsSync(target)) throw new Error('Directorio no encontrado')
    const entries = fs.readdirSync(target, { withFileTypes: true })
    const files = entries
      .map((e) => ({
        name: e.name,
        path: e.name,
        isDir: e.isDirectory(),
        size: e.isFile() ? fs.statSync(path.join(target, e.name)).size : undefined,
        mtime: fs.statSync(path.join(target, e.name)).mtime.toISOString(),
      }))
      .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)))
    return { entries: files, current: dir }
  }

  readFile(id: number, relPath: string): { path: string; content: string } {
    const filePath = safeResolve(this.getBotDir(id), relPath)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory())
      throw new Error('Archivo no encontrado')
    if (!isTextFile(filePath)) throw new Error('Solo se pueden editar archivos de texto')
    return { path: relPath, content: fs.readFileSync(filePath, 'utf8') }
  }

  writeFile(id: number, relPath: string, content: string): void {
    const filePath = safeResolve(this.getBotDir(id), relPath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content ?? '', 'utf8')
  }

  deletePath(id: number, relPath: string): void {
    const target = safeResolve(this.getBotDir(id), relPath)
    fs.rmSync(target, { recursive: true, force: true })
  }

  uploadFile(id: number, relPath: string, buffer: Buffer): string {
    const filePath = safeResolve(this.getBotDir(id), relPath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, buffer)
    return relPath
  }
}

export const botManager = new BotManager(BOT_CONFIG.baseDir)
