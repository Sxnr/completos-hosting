// =========================================================
// DATABASES SERVICE — Instancias de BD nativas en el host
// Cada instancia es un proceso real (PostgreSQL/MariaDB/MySQL)
// con su datadir en el disco del servidor. Sin Docker.
// =========================================================

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import crypto from 'crypto'
import type { Pool } from 'pg'
import { DB_MODULE_CONFIG } from '../config/databases'

export type DBEngine = 'postgresql' | 'mariadb' | 'mysql'
export type DBStatus =
  | 'offline' | 'initializing' | 'starting' | 'online' | 'stopping' | 'error'

interface InstanceRow {
  id: number
  name: string
  engine: DBEngine
  version: string
  port: number
  db_user: string
  db_password: string
  datadir: string
  status: string
  created_by: number | null
}

function randomPassword(): string {
  return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)
}

// ── Instancia individual ───────────────────────────────────
export class DatabaseInstance extends EventEmitter {
  readonly id: number
  readonly engine: DBEngine
  readonly datadir: string
  readonly port: number
  readonly creds: { user: string; password: string }
  readonly version: string

  private process: any = null
  private _status: DBStatus = 'offline'

  constructor(
    id: number, engine: DBEngine, datadir: string, port: number,
    creds: { user: string; password: string }, version: string,
  ) {
    super()
    this.id = id
    this.engine = engine
    this.datadir = datadir
    this.port = port
    this.creds = creds
    this.version = version
  }

  get status(): DBStatus { return this._status }
  get isRunning(): boolean { return this._status === 'online' || this._status === 'starting' }

  // ── Inicializar datos (initdb / --initialize-insecure) ──
  async initialize(): Promise<void> {
    if (fs.existsSync(path.join(this.datadir, 'PG_VERSION')) ||
        fs.existsSync(path.join(this.datadir, 'mysql'))) {
      return // ya inicializado
    }
    fs.mkdirSync(this.datadir, { recursive: true })
    this._setStatus('initializing')

    const bins = DB_MODULE_CONFIG.binaries[this.engine] as any
    if (this.engine === 'postgresql') {
      await runProcess(bins.initdb, ['-D', this.datadir, '-U', this.creds.user, '--auth=trust'])
    } else {
      await runProcess(bins.server, ['--initialize-insecure', '--datadir', this.datadir])
    }
  }

  // ── Start ────────────────────────────────────────────────
  async start(): Promise<void> {
    if (this.isRunning) return
    this._setStatus('starting')

    const bins = DB_MODULE_CONFIG.binaries[this.engine]
    let args: string[]

    if (this.engine === 'postgresql') {
      args = [
        '-D', this.datadir,
        '-p', String(this.port),
        '-c', "listen_addresses='*'",
        '-c', `unix_socket_directories='${this.datadir}'`,
      ]
    } else {
      args = [
        '--datadir', this.datadir,
        '--port', String(this.port),
        '--socket', path.join(this.datadir, 'mysql.sock'),
        '--bind-address=127.0.0.1',
      ]
    }

    this.process = spawn(bins.server, args, { cwd: this.datadir, stdio: ['ignore', 'pipe', 'pipe'] })

    this.process.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (/ready for connections|database system is ready|ready to accept/i.test(text)) {
        if (this._status !== 'online') {
          this._setStatus('online')
          this._postStartSetup().catch(e => this.emit('error', e))
        }
      }
    })
    this.process.stderr.on('data', () => { /* logs útiles pero ruidosos */ })
    this.process.on('close', (code: number | null) => {
      this.process = null
      this._setStatus('offline')
      this.emit('exit', code)
    })
    this.process.on('error', (err: Error) => {
      this._setStatus('error')
      this.emit('error', err)
    })
  }

  // Tras arrancar: fija contraseña / crea el usuario de la app
  private async _postStartSetup(): Promise<void> {
    const bins = DB_MODULE_CONFIG.binaries[this.engine] as any
    if (this.engine === 'postgresql') {
      await runProcess(bins.client, [
        '-h', 'localhost', '-p', String(this.port), '-U', this.creds.user,
        '-c', `ALTER USER "${this.creds.user}" WITH PASSWORD '${this.creds.password}';`,
      ], { PGPASSWORD: this.creds.password })
    } else {
      const socket = path.join(this.datadir, 'mysql.sock')
      const sql =
        `CREATE USER IF NOT EXISTS '${this.creds.user}'@'%' IDENTIFIED BY '${this.creds.password}'; ` +
        `GRANT ALL PRIVILEGES ON *.* TO '${this.creds.user}'@'%' WITH GRANT OPTION; ` +
        `FLUSH PRIVILEGES;`
      await runProcess(bins.client, [
        '-uroot', `--socket=${socket}`, '-e', sql,
      ])
    }
  }

  // ── Stop ─────────────────────────────────────────────────
  async stop(): Promise<void> {
    if (!this.process) { this._setStatus('offline'); return }
    this._setStatus('stopping')
    this.process.kill('SIGTERM')
    const t = setTimeout(() => this.process?.kill('SIGKILL'), 15000)
    this.process.once('close', () => clearTimeout(t))
  }

  // ── Backup (dump) ───────────────────────────────────────
  async backup(targetPath: string): Promise<void> {
    const bins = DB_MODULE_CONFIG.binaries[this.engine] as any
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    if (this.engine === 'postgresql') {
      await runProcess(bins.dump, [
        '-h', 'localhost', '-p', String(this.port), '-U', this.creds.user,
        '-f', targetPath, '--clean', '--create', this.creds.user,
      ], { PGPASSWORD: this.creds.password })
    } else {
      await runProcess(bins.dump, [
        '-u', this.creds.user, `-p${this.creds.password}`,
        '-h', '127.0.0.1', '-P', String(this.port),
        '--all-databases', '-r', targetPath,
      ])
    }
  }

  // ── Restore (desde archivo) ──────────────────────────────
  async restore(sourcePath: string): Promise<void> {
    const bins = DB_MODULE_CONFIG.binaries[this.engine] as any
    if (this.engine === 'postgresql') {
      await runProcess(bins.client, [
        '-h', 'localhost', '-p', String(this.port), '-U', this.creds.user,
        '-f', sourcePath, '-d', 'postgres',
      ], { PGPASSWORD: this.creds.password })
    } else {
      const socket = path.join(this.datadir, 'mysql.sock')
      await runProcess(bins.client, [
        '-u', this.creds.user, `-p${this.creds.password}`,
        '-h', '127.0.0.1', '-P', String(this.port),
        '-e', `SOURCE ${sourcePath};`,
      ])
    }
  }

  private _setStatus(s: DBStatus) {
    this._status = s
    this.emit('status', s)
  }
}

// Ejecuta un proceso y espera a que termine
function runProcess(
  cmd: string, args: string[], env: NodeJS.ProcessEnv = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let errOut = ''
    p.stderr.on('data', (d: Buffer) => { errOut += d.toString() })
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} salió con código ${code}: ${errOut.slice(0, 300)}`)))
    p.on('error', reject)
  })
}

// ── Manager (singleton en memoria) ─────────────────────────
export class DatabaseManager {
  private db: Pool
  private instances: Map<number, DatabaseInstance> = new Map()

  constructor(db: Pool) { this.db = db }

  async init(): Promise<void> {
    fs.mkdirSync(DB_MODULE_CONFIG.baseDir, { recursive: true })
    const { rows } = await this.db.query<InstanceRow>('SELECT * FROM database_instances ORDER BY id ASC')
    for (const r of rows) {
      const inst = new DatabaseInstance(r.id, r.engine, r.datadir, r.port,
        { user: r.db_user, password: r.db_password }, r.version)
      this.instances.set(r.id, inst)
    }
    console.log(`✅ DatabaseManager: ${rows.length} instancias cargadas`)
  }

  private async _nextPort(): Promise<number> {
    const { rows } = await this.db.query<{ port: number }>('SELECT port FROM database_instances ORDER BY port ASC')
    const used = new Set(rows.map(r => r.port))
    let p = DB_MODULE_CONFIG.basePort
    while (used.has(p)) p++
    return p
  }

  async createInstance(opts: {
    name: string; engine: DBEngine; version: string; createdBy?: number;
  }): Promise<InstanceRow> {
    const folder = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
    const datadir = path.join(DB_MODULE_CONFIG.baseDir, folder)
    const port = await this._nextPort()
    const dbUser = `u${crypto.randomBytes(4).toString('hex')}`
    const dbPassword = randomPassword()

    const inst = new DatabaseInstance(0, opts.engine, datadir, port,
      { user: dbUser, password: dbPassword }, opts.version)
    await inst.initialize()

    const { rows } = await this.db.query<InstanceRow>(
      `INSERT INTO database_instances
        (name, engine, version, port, db_user, db_password, datadir, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'offline') RETURNING *`,
      [opts.name, opts.engine, opts.version, port, dbUser, dbPassword, datadir, opts.createdBy ?? null],
    )
    const row = rows[0]
    const realInst = new DatabaseInstance(row.id, row.engine, row.datadir, row.port,
      { user: row.db_user, password: row.db_password }, row.version)
    this.instances.set(row.id, realInst)
    return row
  }

  getInstance(id: number): DatabaseInstance {
    const i = this.instances.get(id)
    if (!i) throw new Error(`Instancia ${id} no encontrada`)
    return i
  }

  async getRow(id: number): Promise<InstanceRow | null> {
    const { rows } = await this.db.query<InstanceRow>('SELECT * FROM database_instances WHERE id=$1', [id])
    return rows[0] || null
  }

  async listInstances(): Promise<(InstanceRow & { status: DBStatus })[]> {
    const { rows } = await this.db.query<InstanceRow>('SELECT * FROM database_instances ORDER BY created_at DESC')
    return rows.map(r => ({ ...r, status: this.instances.get(r.id)?.status || 'offline' }))
  }

  async deleteInstance(id: number): Promise<void> {
    try { await this.getInstance(id).stop() } catch {}
    const row = await this.getRow(id)
    if (row && fs.existsSync(row.datadir)) fs.rmSync(row.datadir, { recursive: true, force: true })
    await this.db.query('DELETE FROM database_instances WHERE id=$1', [id])
    this.instances.delete(id)
  }

  async startInstance(id: number): Promise<void> {
    const inst = this.getInstance(id)
    await inst.start()
    await this.db.query("UPDATE database_instances SET status='online' WHERE id=$1", [id])
  }

  async stopInstance(id: number): Promise<void> {
    await this.getInstance(id).stop()
    await this.db.query("UPDATE database_instances SET status='offline' WHERE id=$1", [id])
  }

  async restartInstance(id: number): Promise<void> {
    await this.stopInstance(id)
    await this.startInstance(id)
  }

  async backup(id: number, fileName: string): Promise<string> {
    const inst = this.getInstance(id)
    const target = path.join(inst.datadir, 'backups', fileName)
    await inst.backup(target)
    return target
  }

  async restore(id: number, filePath: string): Promise<void> {
    const inst = this.getInstance(id)
    if (!fs.existsSync(filePath)) throw new Error('Archivo de respaldo no encontrado')
    await inst.restore(filePath)
  }

  async resetPassword(id: number): Promise<string> {
    const inst = this.getInstance(id)
    const np = randomPassword()
    const row = await this.getRow(id)
    if (!row) throw new Error('No encontrada')
    if (inst.engine === 'postgresql') {
      await runProcess(DB_MODULE_CONFIG.binaries.postgresql.client, [
        '-h', 'localhost', '-p', String(inst.port), '-U', inst.creds.user,
        '-c', `ALTER USER "${inst.creds.user}" WITH PASSWORD '${np}';`,
      ], { PGPASSWORD: inst.creds.password })
    }
    await this.db.query('UPDATE database_instances SET db_password=$1 WHERE id=$2', [np, id])
    inst.creds.password = np
    return np
  }
}
