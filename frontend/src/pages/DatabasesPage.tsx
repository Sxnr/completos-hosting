// =========================================================
// DATABASES PAGE — Gestión nativa de instancias de BD
// =========================================================

import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import {
  listDatabases, createDatabase, deleteDatabase,
  startDatabase, stopDatabase, restartDatabase,
  backupDatabase, restoreDatabase, resetDbPassword,
  type DBInstance,
} from '../services/databases'
import '../styles/databases.css'

const ENGINE_LABEL: Record<string, string> = {
  postgresql: 'PostgreSQL', mariadb: 'MariaDB', mysql: 'MySQL',
}

export default function DatabasesPage() {
  const [items, setItems]     = useState<DBInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)

  // Formulario de creación
  const [name, setName]       = useState('')
  const [engine, setEngine]   = useState('postgresql')
  const [version, setVersion] = useState('16')
  const [busy, setBusy]       = useState(false)

  const load = async () => {
    try { setItems(await listDatabases()); setError(null) }
    catch { setError('Error cargando instancias') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const flash = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok }); setTimeout(() => setFeedback(null), 3500)
  }

  const handleCreate = async () => {
    if (!name.trim()) return flash('Nombre requerido', false)
    setBusy(true)
    try { await createDatabase({ name, engine, version }); flash('Instancia creada', true); setName('') }
    catch (e: any) { flash(e?.response?.data?.message || 'Error al crear', false) }
    finally { setBusy(false); load() }
  }

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); flash(msg, true) } catch (e: any) { flash(e?.response?.data?.message || 'Error', false) }
    finally { load() }
  }

  const handleRestore = async (id: number, file: File | undefined) => {
    if (!file) return
    try { await restoreDatabase(id, file); flash('Restauración iniciada', true) }
    catch (e: any) { flash(e?.response?.data?.message || 'Error al restaurar', false) }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        <div className="page-header">
          <div>
            <h1 className="page-title">Bases de Datos</h1>
            <p className="page-subtitle">Instancias nativas en el servidor (PostgreSQL / MariaDB / MySQL)</p>
          </div>
        </div>

        {feedback && (
          <div className={`process-feedback ${feedback.ok ? 'process-feedback--ok' : 'process-feedback--error'}`}>
            {feedback.msg}
          </div>
        )}
        {error && <div className="login-error">{error}</div>}

        {/* Crear */}
        <div className="db-create card">
          <span className="section-title">Nueva instancia</span>
          <div className="db-create-row">
            <input className="input" placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <select className="input" value={engine} onChange={e => setEngine(e.target.value)}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mariadb">MariaDB</option>
              <option value="mysql">MySQL</option>
            </select>
            <input className="input" placeholder="Versión (label)" value={version} onChange={e => setVersion(e.target.value)} />
            <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
              {busy ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="db-grid">
          {loading ? (
            <div className="card skeleton" style={{ height: 120 }} />
          ) : items.length === 0 ? (
            <div className="card db-empty">No hay instancias. Crea una para empezar.</div>
          ) : items.map(db => (
            <div key={db.id} className="db-card card">
              <div className="db-card-head">
                <span className="db-card-name">{db.name}</span>
                <span className={`badge ${db.status === 'online' ? 'badge-online' : 'badge-offline'}`}>{db.status}</span>
              </div>
              <div className="db-card-meta">
                <span>{ENGINE_LABEL[db.engine]} · v{db.version}</span>
                <span>Puerto {db.port}</span>
                <span>Usuario: <code>{db.db_user}</code></span>
              </div>
              <div className="db-card-actions">
                {db.status === 'online' ? (
                  <button className="btn btn-ghost" onClick={() => act(() => stopDatabase(db.id), 'Detenido')}>Detener</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => act(() => startDatabase(db.id), 'Iniciado')}>Iniciar</button>
                )}
                <button className="btn btn-ghost" onClick={() => act(() => restartDatabase(db.id), 'Reiniciado')}>Reiniciar</button>
                <button className="btn btn-ghost" onClick={() => act(() => backupDatabase(db.id, `backup-${Date.now()}.sql`), 'Respaldo listo')}>Backup</button>
                <label className="btn btn-ghost db-upload">
                  Restaurar
                  <input type="file" accept=".sql" hidden onChange={e => handleRestore(db.id, e.target.files?.[0])} />
                </label>
                <button className="btn btn-ghost" onClick={() => act(() => resetDbPassword(db.id).then(() => load()), 'Contraseña rotada')}>Rotar pass</button>
                <button className="btn btn-danger" onClick={() => act(() => deleteDatabase(db.id), 'Eliminada')}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  )
}
