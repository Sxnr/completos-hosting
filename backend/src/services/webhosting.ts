// =========================================================
// WEB HOSTING SERVICE — Sitios web nativos en el host
// Cada sitio es una carpeta en el disco del servidor, servida
// por el Nginx del host (y php-fpm nativo si se habilita PHP).
// Sin Docker.
// =========================================================

import { execSync } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import type { Pool } from 'pg'
import { WEB_MODULE_CONFIG } from '../config/webhosting'

interface SiteRow {
  id: number
  name: string
  root_dir: string
  php_enabled: boolean
  php_version: string | null
  fpm_port: number | null
  ssl: boolean
  status: string
  created_by: number | null
}

function safeResolve(baseDir: string, subPath = ''): string {
  const resolved = path.resolve(baseDir, subPath)
  if (!resolved.startsWith(path.resolve(baseDir))) throw new Error('Path no permitido')
  return resolved
}

function isTextFile(p: string): boolean {
  return /\.(txt|html|htm|css|js|json|yml|yaml|toml|cfg|conf|ini|log|xml|csv|md|php|env|lock|gitignore)$/i.test(p)
}

export class WebHostingManager extends EventEmitter {
  private db: Pool
  private sites: Map<number, SiteRow> = new Map()
  private phpProcesses: Map<number, any> = new Map()

  constructor(db: Pool) { super(); this.db = db }

  async init(): Promise<void> {
    fs.mkdirSync(WEB_MODULE_CONFIG.baseDir, { recursive: true })
    const { rows } = await this.db.query<SiteRow>('SELECT * FROM web_sites ORDER BY id ASC')
    for (const r of rows) this.sites.set(r.id, r)
    console.log(`✅ WebHostingManager: ${rows.length} sitios cargados`)
  }

  // ── Helpers de Nginx ────────────────────────────────────
  private nginxConfPath(id: number, name: string): string {
    return path.join(WEB_MODULE_CONFIG.nginxAvailable, `completo-web-${id}-${name}`)
  }

  private nginxEnabledPath(id: number, name: string): string {
    return path.join(WEB_MODULE_CONFIG.nginxEnabled, `completo-web-${id}-${name}`)
  }

  private writeNginxConfig(site: SiteRow): void {
    const root = site.root_dir
    const fastcgi = site.php_enabled
      ? `    location ~ \\.php$ {
      include snippets/fastcgi-php.conf;
      fastcgi_pass 127.0.0.1:${site.fpm_port};
    }\n`
      : `    location ~ \\.php$ { return 403; }\n`

    const conf = [
      `server {`,
      `    listen 80;`,
      `    server_name ${site.name};`,
      `    root ${root};`,
      `    index index.html index.htm index.php;`,
      `    location / {`,
      `        try_files $uri $uri/ =404;`,
      `    }`,
      fastcgi,
      `    access_log /var/log/nginx/completo-web-${site.id}.log;`,
      `    error_log /var/log/nginx/completo-web-${site.id}.error.log;`,
      `}`,
      ``,
    ].join('\n')

    fs.writeFileSync(this.nginxConfPath(site.id, site.name), conf)
    const enabled = this.nginxEnabledPath(site.id, site.name)
    if (fs.existsSync(enabled)) fs.unlinkSync(enabled)
    fs.symlinkSync(this.nginxConfPath(site.id, site.name), enabled)
  }

  private removeNginxConfig(site: SiteRow): void {
    for (const p of [this.nginxEnabledPath(site.id, site.name), this.nginxConfPath(site.id, site.name)]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  }

  private reloadNginx(): void {
    try { execSync(WEB_MODULE_CONFIG.nginxReloadCmd, { timeout: 10000 }) }
    catch (e: any) { throw new Error('No se pudo recargar Nginx: ' + e.message) }
  }

  // ── PHP-FPM (best-effort, nativo) ───────────────────────
  private phpPoolPath(site: SiteRow): string {
    return path.join(WEB_MODULE_CONFIG.phpFpmPoolsDir, `completo-web-${site.id}.conf`)
  }

  private writePhpPool(site: SiteRow): void {
    if (!site.php_enabled) return
    const pool = [
      ` [completo-web-${site.id}]`,
      ` user = www-data`,
      ` group = www-data`,
      ` listen = 127.0.0.1:${site.fpm_port}`,
      ` pm = dynamic`,
      ` pm.max_children = 5`,
      ` pm.start_servers = 2`,
      ` pm.min_spare_servers = 1`,
      ` pm.max_spare_servers = 3`,
      ` chdir = ${site.root_dir}`,
      ``,
    ].join('\n')
    fs.mkdirSync(WEB_MODULE_CONFIG.phpFpmPoolsDir, { recursive: true })
    fs.writeFileSync(this.phpPoolPath(site), pool)
  }

  private removePhpPool(site: SiteRow): void {
    const p = this.phpPoolPath(site)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  private reloadPhpFpm(): void {
    try { execSync('systemctl reload php8.2-fpm', { timeout: 10000 }) }
    catch { /* php-fpm puede no estar instalado */ }
  }

  // ── CRUD ────────────────────────────────────────────────
  async createSite(opts: {
    name: string; phpEnabled?: boolean; phpVersion?: string; ssl?: boolean; createdBy?: number;
  }): Promise<SiteRow> {
    const folder = opts.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
    const rootDir = path.join(WEB_MODULE_CONFIG.baseDir, folder)
    fs.mkdirSync(rootDir, { recursive: true })
    // index de bienvenida por defecto
    fs.writeFileSync(path.join(rootDir, 'index.html'),
      `<!doctype html><html><body><h1>Sitio ${opts.name}</h1><p>Desplegado desde Completo Hosting.</p></body></html>`)

    const fpmPort = opts.phpEnabled ? await this._nextFpmPort() : null

    const { rows } = await this.db.query<SiteRow>(
      `INSERT INTO web_sites (name, root_dir, php_enabled, php_version, fpm_port, ssl, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'offline') RETURNING *`,
      [opts.name, rootDir, opts.phpEnabled ?? false, opts.phpVersion ?? null, fpmPort, opts.ssl ?? false, opts.createdBy ?? null],
    )
    const site = rows[0]
    this.sites.set(site.id, site)

    this.writeNginxConfig(site)
    if (site.php_enabled) this.writePhpPool(site)
    this.reloadNginx()
    if (site.php_enabled) this.reloadPhpFpm()

    return site
  }

  async listSites(): Promise<(SiteRow & { status: string })[]> {
    const { rows } = await this.db.query<SiteRow>('SELECT * FROM web_sites ORDER BY created_at DESC')
    return rows
  }

  async getSite(id: number): Promise<SiteRow | null> {
    const { rows } = await this.db.query<SiteRow>('SELECT * FROM web_sites WHERE id=$1', [id])
    return rows[0] || null
  }

  async deleteSite(id: number): Promise<void> {
    const site = await this.getSite(id)
    if (site) {
      this.removeNginxConfig(site)
      this.removePhpPool(site)
      if (fs.existsSync(site.root_dir)) fs.rmSync(site.root_dir, { recursive: true, force: true })
    }
    await this.db.query('DELETE FROM web_sites WHERE id=$1', [id])
    this.sites.delete(id)
    this.reloadNginx()
    this.reloadPhpFpm()
  }

  async startSite(id: number): Promise<void> {
    const site = await this.getSite(id)
    if (!site) throw new Error('Sitio no encontrado')
    this.writeNginxConfig(site)
    if (site.php_enabled) this.writePhpPool(site)
    this.reloadNginx()
    if (site.php_enabled) this.reloadPhpFpm()
    await this.db.query("UPDATE web_sites SET status='online' WHERE id=$1", [id])
  }

  async stopSite(id: number): Promise<void> {
    const site = await this.getSite(id)
    if (!site) throw new Error('Sitio no encontrado')
    this.removeNginxConfig(site)
    this.removePhpPool(site)
    this.reloadNginx()
    if (site.php_enabled) this.reloadPhpFpm()
    await this.db.query("UPDATE web_sites SET status='offline' WHERE id=$1", [id])
  }

  private async _nextFpmPort(): Promise<number> {
    const { rows } = await this.db.query<{ fpm_port: number | null }>(
      'SELECT fpm_port FROM web_sites WHERE fpm_port IS NOT NULL ORDER BY fpm_port ASC')
    const used = new Set(rows.map(r => r.fpm_port!))
    let p = WEB_MODULE_CONFIG.fpmBasePort
    while (used.has(p)) p++
    return p
  }

  // ── File manager (mismo disco del host) ──────────────────
  listFiles(id: number, dir = ''): any[] {
    const site = this._row(id)
    const target = safeResolve(site.root_dir, dir)
    const entries = fs.readdirSync(target, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(target, e.name)).size : null,
      modified: fs.statSync(path.join(target, e.name)).mtime.toISOString(),
    })).sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1))
  }

  readFile(id: number, relPath: string): string {
    const site = this._row(id)
    const fp = safeResolve(site.root_dir, relPath)
    if (!fs.statSync(fp).isFile() || !isTextFile(fp)) throw new Error('Archivo no editable')
    return fs.readFileSync(fp, 'utf8')
  }

  writeFile(id: number, relPath: string, content: string): void {
    const site = this._row(id)
    const fp = safeResolve(site.root_dir, relPath)
    fs.mkdirSync(path.dirname(fp), { recursive: true })
    fs.writeFileSync(fp, content, 'utf8')
  }

  deletePath(id: number, relPath: string): void {
    const site = this._row(id)
    const fp = safeResolve(site.root_dir, relPath)
    fs.rmSync(fp, { recursive: true, force: true })
  }

  uploadFile(id: number, relPath: string, data: Buffer): void {
    const site = this._row(id)
    const fp = safeResolve(site.root_dir, relPath)
    fs.mkdirSync(path.dirname(fp), { recursive: true })
    fs.writeFileSync(fp, data)
  }

  private _row(id: number): SiteRow {
    const s = this.sites.get(id)
    if (s) return s
    throw new Error('Sitio no encontrado en memoria')
  }
}
