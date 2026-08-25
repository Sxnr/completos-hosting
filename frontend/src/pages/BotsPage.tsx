// =========================================================
// BOTS PAGE — Lista de bots y creación
// =========================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { botsService, type Bot } from '../services/bots'
import { toast } from '../components/Toast'
import '../styles/bots.css'

type StatusKey = 'offline' | 'starting' | 'running' | 'stopping' | 'crashed'

const STATUS_CLASS: Record<StatusKey, string> = {
  offline:  'status-dot--offline',
  starting: 'status-dot--starting',
  running:  'status-dot--online',
  stopping: 'status-dot--stopping',
  crashed:  'status-dot--offline',
}

const STATUS_LABEL: Record<StatusKey, string> = {
  offline:  'Apagado',
  starting: 'Iniciando',
  running:  'En línea',
  stopping: 'Deteniendo',
  crashed:  'Caído',
}

function BotCard({ bot, onOpen, onAction }: {
  bot: Bot
  onOpen: () => void
  onAction: (action: 'start' | 'stop' | 'restart') => void
}) {
  const status = (bot.status as StatusKey) || 'offline'
  return (
    <div className="bot-card card">
      <div className="bot-card-top">
        <div className="bot-card-info">
          <div className={`status-dot ${STATUS_CLASS[status]}`} />
          <div>
            <h3 className="bot-card-name">{bot.name}</h3>
            <span className="bot-card-meta">
              {bot.source === 'git' ? `git · ${bot.repo ?? '—'}` : 'archivos'}
            </span>
          </div>
        </div>
        <span className={`badge ${status === 'running' ? 'badge-online' : status === 'crashed' ? 'badge-offline' : 'badge-info'}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="bot-card-cmd">
        <span className="bot-card-cmd-label">Comando</span>
        <code className="bot-card-cmd-value">{bot.runCommand}</code>
      </div>

      <div className="bot-card-actions">
        {status === 'running' || status === 'starting' ? (
          <button className="btn btn-ghost" onClick={() => onAction('stop')}>Detener</button>
        ) : (
          <button className="btn btn-primary" onClick={() => onAction('start')}>Iniciar</button>
        )}
        <button className="btn btn-ghost" onClick={() => onAction('restart')}>Reiniciar</button>
        <button className="btn btn-ghost" onClick={onOpen}>Abrir</button>
      </div>
    </div>
  )
}

export default function BotsPage() {
  const navigate = useNavigate()
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [source, setSource] = useState<'upload' | 'git'>('upload')
  const [repo, setRepo] = useState('')
  const [runCommand, setRunCommand] = useState('npm start')
  const [autostart, setAutostart] = useState(true)
  const [envRows, setEnvRows] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

  const load = async () => {
    try {
      const data = await botsService.list()
      setBots(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cargar los bots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const action = async (id: number, kind: 'start' | 'stop' | 'restart') => {
    try {
      if (kind === 'start') await botsService.start(id)
      if (kind === 'stop') await botsService.stop(id)
      if (kind === 'restart') await botsService.restart(id)
      const map = { start: 'iniciado', stop: 'detenido', restart: 'reiniciado' } as const
      toast.success(`Bot ${map[kind]}`)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Error al ${kind}`)
    }
  }

  const create = async () => {
    if (!name.trim()) { toast.error('Ingresa un nombre para el bot'); return }
    if (source === 'git' && !repo.trim()) { toast.error('Ingresa la URL del repositorio'); return }
    setSaving(true)
    const env: Record<string, string> = {}
    envRows.filter(r => r.key.trim()).forEach(r => { env[r.key.trim()] = r.value })
    try {
      await botsService.create({ name: name.trim(), source, repo: repo.trim() || undefined, runCommand: runCommand.trim() || 'npm start', autostart, env })
      toast.success('Bot creado correctamente')
      setShowForm(false)
      setName(''); setRepo(''); setEnvRows([{ key: '', value: '' }]); setAutostart(true)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear el bot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        <div className="page-header">
          <div>
            <h1 className="page-title">Bots</h1>
            <p className="page-subtitle">Hosting de bots 24/7 (Discord, automatizaciones y más)</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nuevo Bot'}
          </button>
        </div>

        <div className="page-help">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            Cada bot corre como un proceso independiente en el servidor y se mantiene <strong>encendido 24/7</strong> (se reinicia solo si falla).
            Sube los archivos del bot o clona un repositorio Git, configura las variables (como el <code>DISCORD_TOKEN</code>) y presiona Iniciar.
          </span>
        </div>

        {showForm && (
          <div className="card bot-form">
            <h3 className="bot-form-title">Nuevo Bot</h3>

            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ej: BotDeDiscord" />
            </div>

            <div className="form-group">
              <label className="form-label">Origen de los archivos</label>
              <select className="input" value={source} onChange={e => setSource(e.target.value as 'upload' | 'git')}>
                <option value="upload">Subir archivos manualmente</option>
                <option value="git">Clonar repositorio Git</option>
              </select>
            </div>

            {source === 'git' && (
              <div className="form-group">
                <label className="form-label">URL del repositorio</label>
                <input className="input" value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/usuario/bot.git" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Comando de inicio</label>
              <input className="input" value={runCommand} onChange={e => setRunCommand(e.target.value)} placeholder="npm start" />
            </div>

            <div className="form-group bot-form-env">
              <label className="form-label">Variables de entorno</label>
              {envRows.map((row, i) => (
                <div key={i} className="bot-env-row">
                  <input className="input" placeholder="CLAVE" value={row.key}
                    onChange={e => { const c = [...envRows]; c[i] = { ...c[i], key: e.target.value }; setEnvRows(c) }} />
                  <input className="input" placeholder="valor" value={row.value}
                    onChange={e => { const c = [...envRows]; c[i] = { ...c[i], value: e.target.value }; setEnvRows(c) }} />
                  <button className="btn btn-ghost btn-icon" onClick={() => setEnvRows(envRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setEnvRows([...envRows, { key: '', value: '' }])}>
                + Añadir variable
              </button>
            </div>

            <label className="bot-toggle">
              <input type="checkbox" checked={autostart} onChange={e => setAutostart(e.target.checked)} />
              <span>Iniciar automáticamente al arrancar el servidor</span>
            </label>

            <div className="bot-form-actions">
              <button className="btn btn-primary" onClick={create} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Crear bot'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bots-grid">
            {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 150 }} />)}
          </div>
        ) : bots.length === 0 && !showForm ? (
          <div className="card bot-empty">
            <p>Aún no tienes bots. Crea uno para hostear tu bot 24/7.</p>
          </div>
        ) : (
          <div className="bots-grid">
            {bots.map(bot => (
              <BotCard
                key={bot.id}
                bot={bot}
                onOpen={() => navigate(`/bots/${bot.id}`)}
                onAction={kind => action(bot.id, kind)}
              />
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
