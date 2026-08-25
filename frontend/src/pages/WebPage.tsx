// =========================================================
// WEB PAGE — Sitios web nativos en el host + file manager
// =========================================================

import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import {
  listSites, createSite, deleteSite, startSite, stopSite,
  listFiles, readFile, writeFile, deleteFile, uploadFile,
  type WebSite, type FileEntry,
} from '../services/web'
import { toast } from '../components/Toast'
import '../styles/databases.css'

export default function WebPage() {
  const [sites, setSites]       = useState<WebSite[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [name, setName]   = useState('')
  const [php, setPhp]     = useState(false)
  const [busy, setBusy]   = useState(false)

  // File manager
  const [current, setCurrent]   = useState<WebSite | null>(null)
  const [dir, setDir]           = useState('')
  const [files, setFiles]       = useState<FileEntry[]>([])
  const [editing, setEditing]   = useState<{ path: string; content: string } | null>(null)

  const load = async () => {
    try { setSites(await listSites()); setError(null) }
    catch { setError('Error cargando sitios') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const flash = (msg: string, ok: boolean) => {
    ok ? toast.success(msg) : toast.error(msg)
  }

  const handleCreate = async () => {
    if (!name.trim()) return flash('Nombre requerido', false)
    setBusy(true)
    try { await createSite({ name, phpEnabled: php, phpVersion: '8.2' }); flash('Sitio creado', true); setName('') }
    catch (e: any) { flash(e?.response?.data?.message || 'Error al crear', false) }
    finally { setBusy(false); load() }
  }

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); flash(msg, true) } catch (e: any) { flash(e?.response?.data?.message || 'Error', false) }
    finally { load() }
  }

  const openSite = async (site: WebSite) => {
    setCurrent(site); setDir(''); setEditing(null)
    try { const d = await listFiles(site.id, ''); setFiles(d.files) }
    catch { setFiles([]) }
  }

  const navigate = async (sub: string) => {
    if (!current) return
    const nd = sub === '..' ? dir.split('/').slice(0, -1).join('/') : (dir ? dir + '/' + sub : sub)
    try { const d = await listFiles(current.id, nd); setFiles(d.files); setDir(nd) }
    catch { flash('No se pudo abrir la carpeta', false) }
  }

  const viewFile = async (path: string) => {
    if (!current) return
    try { const f = await readFile(current.id, path); setEditing({ path, content: f.content }) }
    catch { flash('No se pudo leer el archivo', false) }
  }

  const saveFile = async () => {
    if (!current || !editing) return
    try { await writeFile(current.id, editing.path, editing.content); flash('Guardado', true); setEditing(null) }
    catch (e: any) { flash(e?.response?.data?.message || 'Error al guardar', false) }
  }

  const handleUpload = async (file: File | undefined) => {
    if (!current || !file) return
    const path = dir ? dir + '/' + file.name : file.name
    try { await uploadFile(current.id, path, file); flash('Subido', true); openSite(current) }
    catch (e: any) { flash(e?.response?.data?.message || 'Error al subir', false) }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        <div className="page-header">
          <div>
            <h1 className="page-title">Web Hosting</h1>
            <p className="page-subtitle">Sitios en el disco del servidor, servidos por Nginx nativo</p>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="db-create card">
          <span className="section-title">Nuevo sitio</span>
          <div className="db-create-row">
            <input className="input" placeholder="Dominio o nombre (ej: mi-sitio.com)" value={name} onChange={e => setName(e.target.value)} />
            <label className="web-php-toggle">
              <input type="checkbox" checked={php} onChange={e => setPhp(e.target.checked)} /> PHP
            </label>
            <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
              {busy ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>

        <div className="db-grid">
          {loading ? (
            <div className="card skeleton" style={{ height: 90 }} />
          ) : sites.length === 0 ? (
            <div className="card db-empty">No hay sitios. Crea uno para empezar.</div>
          ) : sites.map(s => (
            <div key={s.id} className="db-card card">
              <div className="db-card-head">
                <span className="db-card-name">{s.name}</span>
                <span className={`badge ${s.status === 'online' ? 'badge-online' : 'badge-offline'}`}>{s.status}</span>
              </div>
              <div className="db-card-meta">
                <span>{s.php_enabled ? 'PHP habilitado' : 'Estático'}</span>
                <span>{s.root_dir}</span>
              </div>
              <div className="db-card-actions">
                <button className="btn btn-ghost" onClick={() => openSite(s)}>Archivos</button>
                {s.status === 'online' ? (
                  <button className="btn btn-ghost" onClick={() => act(() => stopSite(s.id), 'Sitio detenido')}>Detener</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => act(() => startSite(s.id), 'Sitio publicado')}>Publicar</button>
                )}
                <button className="btn btn-danger" onClick={() => act(() => deleteSite(s.id), 'Sitio eliminado')}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>

        {/* File manager */}
        {current && (
          <div className="web-fm card">
            <div className="web-fm-head">
              <span className="section-title">Archivos: {current.name}</span>
              <div className="web-fm-tools">
                <span className="web-fm-path">/ {dir || '(raíz)'}</span>
                <label className="btn btn-ghost db-upload">
                  Subir
                  <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0])} />
                </label>
                <button className="btn btn-ghost" onClick={() => openSite(current)}>Refrescar</button>
              </div>
            </div>

            {editing ? (
              <div className="web-editor">
                <span className="web-editor-path">{editing.path}</span>
                <textarea className="web-editor-area" value={editing.content}
                  onChange={e => setEditing({ ...editing, content: e.target.value })} />
                <div className="web-editor-actions">
                  <button className="btn btn-primary" onClick={saveFile}>Guardar</button>
                  <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cerrar</button>
                </div>
              </div>
            ) : (
              <table className="web-fm-table">
                <thead><tr><th>Nombre</th><th>Tamaño</th><th>Modificado</th><th></th></tr></thead>
                <tbody>
                  {dir && (
                    <tr className="web-fm-row">
                      <td colSpan={4}><button className="web-link" onClick={() => navigate('..')}>.. (subir)</button></td>
                    </tr>
                  )}
                  {files.map(f => (
                    <tr key={f.name} className="web-fm-row">
                      <td>
                        <button className="web-link" onClick={() => f.isDir ? navigate(f.name) : viewFile((dir ? dir + '/' : '') + f.name)}>
                          {f.isDir ? '📁 ' : '📄 '}{f.name}
                        </button>
                      </td>
                      <td>{f.size != null ? (f.size / 1024).toFixed(1) + ' KB' : '—'}</td>
                      <td>{new Date(f.modified).toLocaleString()}</td>
                      <td>
                        {!f.isDir && (
                          <button className="btn btn-ghost btn-sm" onClick={() => viewFile((dir ? dir + '/' : '') + f.name)}>Editar</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => act(() => deleteFile(current.id, (dir ? dir + '/' : '') + f.name).then(() => openSite(current)), 'Eliminado')}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
