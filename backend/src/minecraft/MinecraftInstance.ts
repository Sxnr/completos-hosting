// =========================================================
// MINECRAFT INSTANCE — Representa un servidor corriendo
// Gestiona el proceso Java, consola y estado en tiempo real
// =========================================================

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { MC_CONFIG } from '../config/minecraft'

export type InstanceStatus =
  | 'offline'
  | 'starting'
  | 'online'
  | 'stopping'

export interface ConsoleMessage {
  timestamp: string
  level:     'INFO' | 'WARN' | 'ERROR' | 'UNKNOWN'
  text:      string
  raw:       string
}

// Parsea una línea de log de Minecraft para extraer nivel y texto
const parseLogLine = (raw: string): ConsoleMessage => {
  const timestamp = new Date().toISOString()

  // Formato: [HH:MM:SS] [Thread/LEVEL]: message
  const match = raw.match(/\[.*?\]\s+\[.*?\/(INFO|WARN|ERROR|FATAL)\]:\s*(.*)/i)
  if (match) {
    return {
      timestamp,
      level: (match[1].toUpperCase() === 'FATAL' ? 'ERROR' : match[1].toUpperCase()) as ConsoleMessage['level'],
      text: match[2],
      raw,
    }
  }

  // Formato alternativo Paper: [HH:MM:SS INFO]: message
  const match2 = raw.match(/\[.*?\s+(INFO|WARN|ERROR)\]:\s*(.*)/i)
  if (match2) {
    return {
      timestamp,
      level: match2[1].toUpperCase() as ConsoleMessage['level'],
      text: match2[2],
      raw,
    }
  }

  return { timestamp, level: 'UNKNOWN', text: raw, raw }
}

export class MinecraftInstance extends EventEmitter {
  readonly id:         number
  readonly folderPath: string

  private process:    ChildProcessWithoutNullStreams | null = null
  private _status:    InstanceStatus = 'offline'
  private _players:   Set<string>    = new Set()
  private _console:   ConsoleMessage[] = []   // Historial en memoria

  constructor(id: number, folderName: string) {
    super()
    this.id         = id
    this.folderPath = path.join(MC_CONFIG.serversDir, folderName)
  }

  // ── Getters ───────────────────────────────────────────
  get status():      InstanceStatus { return this._status }
  get players():     string[]        { return [...this._players] }
  get playerCount(): number          { return this._players.size }
  get consoleLog():  ConsoleMessage[] { return [...this._console] }
  get isRunning():   boolean          { return this._status !== 'offline' }

  // ── Start ─────────────────────────────────────────────
  async start(opts: {
    jarFile:   string    // Ruta absoluta al JAR
    ramMb:     number    // RAM en MB
    javaFlags: string    // Flags extra JVM
  }): Promise<void> {
    if (this.isRunning) throw new Error('El servidor ya está corriendo')

    // Verifica que el JAR existe
    if (!fs.existsSync(opts.jarFile)) {
      throw new Error(`JAR no encontrado: ${opts.jarFile}`)
    }

    // Acepta el EULA automáticamente si no existe
    const eulaPath = path.join(this.folderPath, 'eula.txt')
    if (!fs.existsSync(eulaPath)) {
      fs.writeFileSync(eulaPath, 'eula=true\n')
    }

    this._setStatus('starting')

    // Construye los argumentos de Java
    const javaArgs = [
      `-Xmx${opts.ramMb}M`,
      `-Xms${Math.floor(opts.ramMb / 2)}M`,
      // Flags de performance G1GC recomendados para Minecraft
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1HeapRegionSize=8M',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
      // Flags extra del usuario
      ...opts.javaFlags.split(' ').filter(Boolean),
      '-jar', opts.jarFile,
      'nogui',   // Sin ventana de Swing
    ]

    // Lanza el proceso Java en la carpeta del servidor
    this.process = spawn(MC_CONFIG.javaExecutable, javaArgs, {
      cwd:   this.folderPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // ── Lee stdout línea por línea ──────────────────────
    let stdoutBuffer = ''
    this.process.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || ''   // El último fragmento puede estar incompleto

      for (const line of lines) {
        if (!line.trim()) continue
        this._handleLogLine(line)
      }
    })

    // ── Lee stderr (también tiene logs útiles) ──────────
    let stderrBuffer = ''
    this.process.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      const lines = stderrBuffer.split('\n')
      stderrBuffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        this._handleLogLine(line)
      }
    })

    // ── Proceso terminó ─────────────────────────────────
    this.process.on('close', (code) => {
      this.process = null
      this._players.clear()
      this._setStatus('offline')
      this._addConsole({
        timestamp: new Date().toISOString(),
        level: code === 0 ? 'INFO' : 'WARN',
        text: `Proceso terminado con código ${code}`,
        raw: `Proceso terminado con código ${code}`,
      })
    })

    this.process.on('error', (err) => {
      this._setStatus('offline')
      this.emit('error', err)
    })
  }

  // ── Stop ──────────────────────────────────────────────
  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) return

    this._setStatus('stopping')

    // Envía el comando /stop al servidor
    this.sendCommand('stop')

    // Si no termina en el timeout, fuerza el kill
    const timeout = setTimeout(() => {
      if (this.process) {
        this.process.kill('SIGKILL')
      }
    }, MC_CONFIG.stopTimeoutMs)

    // Cuando cierre limpiamente, cancela el timeout
    this.process.once('close', () => clearTimeout(timeout))
  }

  // ── Restart ───────────────────────────────────────────
  async restart(opts: Parameters<MinecraftInstance['start']>[0]): Promise<void> {
    if (this.isRunning) await this.stop()

    // Espera hasta que esté offline
    await new Promise<void>(resolve => {
      if (this._status === 'offline') return resolve()
      this.once('status', (s: InstanceStatus) => {
        if (s === 'offline') resolve()
      })
    })

    await this.start(opts)
  }

  // ── Enviar comando ────────────────────────────────────
  sendCommand(command: string): void {
    if (!this.process?.stdin.writable) return
    this.process.stdin.write(command + '\n')
  }

  // ── Privados ──────────────────────────────────────────

  private _setStatus(status: InstanceStatus): void {
    this._status = status
    this.emit('status', status)
  }

  private _handleLogLine(raw: string): void {
    const msg = parseLogLine(raw)
    this._addConsole(msg)

    // Detecta cuando el servidor terminó de cargar
    if (
      raw.includes('Done (') && raw.includes('For help, type "help"')
      || raw.includes('Done! For help')
    ) {
      this._setStatus('online')
    }

    // Detecta jugadores conectándose: "UUID of player Steve is ..."
    const joinMatch = raw.match(/(\w+)\[.*\] logged in/)
    if (joinMatch) {
      this._players.add(joinMatch[1])
      this.emit('playerJoin', joinMatch[1])
    }

    // Detecta jugadores desconectándose: "Steve lost connection"
    const leaveMatch = raw.match(/(\w+) lost connection/)
    if (leaveMatch) {
      this._players.delete(leaveMatch[1])
      this.emit('playerLeave', leaveMatch[1])
    }
  }

  private _addConsole(msg: ConsoleMessage): void {
    this._console.push(msg)

    // Mantiene solo los últimos MAX_CONSOLE_LINES mensajes
    if (this._console.length > MC_CONFIG.maxConsoleLines) {
      this._console.shift()
    }

    // Emite el mensaje a todos los listeners (WebSockets)
    this.emit('console', msg)
  }
}