// =========================================================
// SETTINGS PAGE — Configuración y gestión de usuarios
// =========================================================

import { useState, type FormEvent } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { useSettings }  from '../hooks/useSettings'
import '../styles/settings.css'

// Tipos de feedback para formularios
interface Feedback { msg: string; ok: boolean }

// ── Sub-componente: Cambio de contraseña ─────────────────
function PasswordSection({
  onSave,
}: {
  onSave: (current: string, next: string) => Promise<void>
}) {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      setFeedback({ msg: 'Las contraseñas nuevas no coinciden', ok: false })
      return
    }
    setSaving(true)
    try {
      await onSave(current, next)
      setFeedback({ msg: 'Contraseña actualizada correctamente', ok: true })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al cambiar la contraseña'
      setFeedback({ msg, ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="settings-card card">
      <div className="settings-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>Cambiar Contraseña</span>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="current-pass" className="form-label">Contraseña actual</label>
          <input
            id="current-pass"
            type="password"
            className="input"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="new-pass" className="form-label">Nueva contraseña</label>
          <input
            id="new-pass"
            type="password"
            className="input"
            placeholder="Mínimo 8 caracteres"
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm-pass" className="form-label">Confirmar nueva contraseña</label>
          <input
            id="confirm-pass"
            type="password"
            className="input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {feedback && (
          <div className={`settings-feedback ${feedback.ok ? 'settings-feedback--ok' : 'settings-feedback--error'}`}>
            {feedback.msg}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" /> Guardando...</> : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  )
}

// ── Sub-componente: Gestión de usuarios ──────────────────
function UsersSection({
  users,
  currentUserId,
  onCreate,
  onDelete,
}: {
  users:         ReturnType<typeof useSettings>['users']
  currentUserId: number
  onCreate:      (u: string, p: string, r: 'admin' | 'viewer') => Promise<void>
  onDelete:      (id: number) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<'admin' | 'viewer'>('viewer')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await onCreate(username, password, role)
      setFeedback({ msg: `Usuario '${username}' creado correctamente`, ok: true })
      setUsername(''); setPassword('')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al crear el usuario'
      setFeedback({ msg, ok: false })
    } finally {
      setCreating(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      await onDelete(id)
      setFeedback({ msg: `Usuario '${name}' eliminado`, ok: true })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al eliminar el usuario'
      setFeedback({ msg, ok: false })
    } finally {
      setDeleting(null)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="settings-card card">
      <div className="settings-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Gestión de Usuarios</span>
      </div>

      {/* Lista de usuarios actuales */}
      <div className="users-list">
        {users.map(u => (
          <div key={u.id} className="user-row">
            <div className="user-row-info">
              {/* Avatar con inicial */}
              <div className="user-avatar">
                {u.username[0].toUpperCase()}
              </div>
              <div>
                <span className="user-name">{u.username}</span>
                {u.id === currentUserId && (
                  <span className="user-you"> (tú)</span>
                )}
              </div>
            </div>
            <div className="user-row-actions">
              <span className={`badge ${u.role === 'admin' ? 'badge-online' : 'badge-info'}`}>
                {u.role}
              </span>
              {/* Solo puede eliminar otros usuarios, no a sí mismo */}
              {u.id !== currentUserId && (
                <button
                  className="btn btn-ghost user-delete-btn"
                  onClick={() => handleDelete(u.id, u.username)}
                  disabled={deleting === u.id}
                >
                  {deleting === u.id ? <span className="spinner" /> : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Separador */}
      <div className="settings-divider" />

      {/* Formulario para crear usuario */}
      <p className="settings-subsection-title">Crear nuevo usuario</p>

      <form className="settings-form settings-form--row" onSubmit={handleCreate}>
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">Nombre de usuario</label>
          <input
            type="text"
            className="input"
            placeholder="ej: viewer1"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">Contraseña</label>
          <input
            type="password"
            className="input"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Rol</label>
          <select
            className="input"
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'viewer')}
          >
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div className="form-group form-group--btn">
          <label className="form-label">&nbsp;</label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? <span className="spinner" /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
            Crear
          </button>
        </div>
      </form>

      {feedback && (
        <div className={`settings-feedback ${feedback.ok ? 'settings-feedback--ok' : 'settings-feedback--error'}`}>
          {feedback.msg}
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────
export default function SettingsPage() {
  const { profile, users, loading, changePassword, createUser, deleteUser } = useSettings()

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        {/* ── Header ─────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Configuración</h1>
            <p className="page-subtitle">Gestiona tu cuenta y los usuarios del sistema</p>
          </div>
          {profile && (
            <div className="profile-badge card">
              <div className="user-avatar user-avatar--lg">
                {profile.username[0].toUpperCase()}
              </div>
              <div>
                <span className="user-name">{profile.username}</span>
                <span className={`badge ${profile.role === 'admin' ? 'badge-online' : 'badge-info'}`}>
                  {profile.role}
                </span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="settings-skeleton">
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div className="skeleton skeleton-heading" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <div className="settings-grid">
            {/* Cambio de contraseña — siempre visible */}
            <PasswordSection onSave={changePassword} />

            {/* Gestión de usuarios — solo admin */}
            {profile?.role === 'admin' && (
              <UsersSection
                users={users}
                currentUserId={profile.id}
                onCreate={createUser}
                onDelete={deleteUser}
              />
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}