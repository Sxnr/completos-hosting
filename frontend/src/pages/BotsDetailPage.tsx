// =========================================================
// BOTS DETAIL PAGE — Consola, archivos y configuración
// =========================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { botsService, type Bot } from '../services/bots'
import { useBotsConsole, type BotStatus } from '../hooks/useBotsConsole'
import { toast } from '../components/Toast'
import { api } from '../services/api'
import '../styles/bots.css'

type Tab = 'console' | 'files' | 'config'

const STATUS_CLASS: Record<BotStatus, string> = {
  offline:  'status-dot--offline',
  starting: 'status-dot--starting',
  running:  'status-dot--online',
  stopping: 'status-dot--stopping',
  crashed:  'status-dot--offline',
}

const STATUS_LABEL: Record<BotStatus, string> = {
  offline:  'Apagado',
  starting: 'Iniciando',
  running:  'En línea',
  stopping: 'Deteniendo',
  crashed:  'Caído',
}

const formatBytes = (b?: number | null) => {
  if (b == null) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(1)} GB`
}

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString('es-CL') : '—'

export default function BotsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const botId = parseInt(id ?? '0')

  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('console')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { lines, status, connected, sendCommand, clear } = useBotsConsole(bot ? botId : null)

  // ── File manager state ──
  const [path, setPath] = useState('')
  const [files, setFiles] = useState<Array<{ name: string; path: string; isDir: boolean; size?: number; mtime?: string }>>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [filesError, setFilesError] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [isBinary, setIsBinary] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [fileSaving, setFileSaving] = useState(false)
  const [fileDeleting, setFileDeleting] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const uploadDirRef = useRef<boolean>(false)

  // ── Env editor state ──
  const [envRows, setEnvRows] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])
  const [savingEnv, setSavingEnv] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadBot = useCallback(async () => {
    try {
      const data = await botsService.get(botId)
      setBot(data)
    } catch {
      navigate('/bots')
    } finally {
      setLoading(false)
    }
  }, [botId, navigate])

  useEffect(() => { loadBot() }, [loadBot])

  // ── File manager ──
  const loadDir = useCallback(async (dir: string) => {
    setPath(dir)
    setSelectedFile(null)
    setFileContent('')
    setLoadingFiles(true)
    setFilesError('')
    try {
      const res = await botsService.listFiles(botId, dir)
      setFiles(res.entries)
    } catch (err: any) {
      setFilesError(err?.response?.data?.message || 'Error al listar archivos')
    } finally {
      setLoadingFiles(false)
    }
  }, [botId])

  useEffect(() => {
    if (activeTab === 'files') loadDir('')
  }, [activeTab, loadDir])

  const openFile = async (filePath: string) => {
    setSelectedFile(filePath)
    setFileLoading(true)
    setFileError('')
    setIsBinary(false)
    setEditorDirty(false)
    setSavedOk(false)
    try {
      const res = await botsService.readFile(botId, filePath)
      if (!res.isText) { setIsBinary(true); setFileContent('') }
      else setFileContent(res.content)
    } catch (err: any) {
      setFileError(err?.response?.data?.message || 'Error al leer el archivo')
    } finally {
      setFileLoading(false)
    }
  }

  const saveFile = async () => {
    if (!selectedFile) return
    setFileSaving(true)
    try {
      await botsService.writeFile(botId, selectedFile, fileContent)
      setEditorDirty(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar')
    } finally {
      setFileSaving(false)
    }
  }

  const deletePath = async (filePath: string) => {
    if (!confirm(`¿Eliminar "${filePath}"? Esta acción no se puede deshacer.`)) return
    setFileDeleting(true)
    try {
      await botsService.deletePath(botId, filePath)
      toast.success('Archivo eliminado')
      if (selectedFile === filePath) { setSelectedFile(null); setFileContent('') }
      loadDir(path)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al eliminar')
    } finally {
      setFileDeleting(false)
    }
  }

  const triggerUpload = (asDir: boolean) => {
    uploadDirRef.current = asDir
    const input = uploadRef.current
    if (!input) return
    if (asDir) input.setAttribute('webkitdirectory', '')
    else input.removeAttribute('webkitdirectory')
    input.click()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files
    if (!filesList || filesList.length === 0) return
    const targetDir = path
    for (const f of Array.from(filesList)) {
      const rel = uploadDirRef.current && (f as any).webkitRelativePath
        ? (f as any).webkitRelativePath
        : f.name
      const finalRel = targetDir ? `${targetDir}/${rel}` : rel
      const form = new FormData()
      form.append('file', f)
      form.append('path', finalRel)
      try {
        await api.post(botsService.uploadUrl(botId), form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } catch (err: any) {
        toast.error(`Error subiendo ${f.name}: ${err?.response?.data?.message || ''}`)
      }
    }
    toast.success('Archivos subidos')
    loadDir(path)
    e.target.value = ''
  }

  // ── Acciones ──
  const doAction = async (kind: 'start' | 'stop' | 'restart') => {
    setActionLoading(kind)
    try {
      if (kind === 'start') await botsService.start(botId)
      if (kind === 'stop') await botsService.stop(botId)
      if (kind === 'restart') await botsService.restart(botId)
      const map = { start: 'iniciado', stop: 'detenido', restart: 'reiniciado' } as const
      toast.success(`Bot ${map[kind]}`)
      loadBot()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Error al ${kind}`)
    } finally {
      setActionLoading(null)
    }
  }

  const doPull = async () => {
    setPulling(true)
    try {
      await botsService.pull(botId)
      toast.success('git pull ejecutado')
      loadDir('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error en git pull')
    } finally {
      setPulling(false)
    }
  }

  const saveEnv = async () => {
    const env: Record<string, string> = {}
    envRows.filter(r => r.key.trim()).forEach(r => { env[r.key.trim()] = r.value })
    setSavingEnv(true)
    try {
      await botsService.updateEnv(botId, env)
      toast.success('Variables guardadas')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar variables')
    } finally {
      setSavingEnv(false)
    }
  }

  const doDelete = async () => {
    if (!confirm(`¿Eliminar el bot "${bot?.name}" y todos sus archivos?`)) return
    setDeleting(true)
    try {
      await botsService.delete(botId)
      toast.success('Bot eliminado')
      navigate('/bots')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al eliminar')
      setDeleting(false)
    }
  }

  const breadcrumbs = path
    ? path.split('/').filter(Boolean).map((part, i, arr) => ({ label: part, p: arr.slice(0, i + 1).join('/') }))
    : []
  const goUp = () => {
    const parts = path.split('/').filter(Boolean)
    parts.pop()
    loadDir(parts.join('/'))
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-content">
          <div className="card skeleton" style={{ height: 200 }} />
        </div>
      </DashboardLayout>
    )
  }
  if (!bot) return null

  const currentStatus = (status || (bot.status as BotStatus) || 'offline') as BotStatus

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bots')}>← Bots</button>
            <h1 className="page-title" style={{ marginTop: 8 }}>{bot.name}</h1>
            <p className="page-subtitle">
              {bot.source === 'git' ? `Repositorio Git · ${bot.repo ?? '—'}` : 'Archivos subidos'} · {bot.runCommand}
            </p>
          </div>
          <div className="bot-detail-actions">
            <span className={`badge ${currentStatus === 'running' ? 'badge-online' : currentStatus === 'crashed' ? 'badge-offline' : 'badge-info'}`}>
              <span className={`status-dot ${STATUS_CLASS[currentStatus]}`} style={{ width: 8, height: 8 }} />
              {STATUS_LABEL[currentStatus]}
            </span>
            {currentStatus === 'running' || currentStatus === 'starting' ? (
              <button className="btn btn-ghost" disabled={actionLoading === 'stop'} onClick={() => doAction('stop')}>
                {actionLoading === 'stop' ? <span className="spinner" /> : 'Detener'}
              </button>
            ) : (
              <button className="btn btn-primary" disabled={actionLoading === 'start'} onClick={() => doAction('start')}>
                {actionLoading === 'start' ? <span className="spinner" /> : 'Iniciar'}
              </button>
            )}
            <button className="btn btn-ghost" disabled={actionLoading === 'restart'} onClick={() => doAction('restart')}>
              {actionLoading === 'restart' ? <span className="spinner" /> : 'Reiniciar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bot-tabs">
          {(['console', 'files', 'config'] as Tab[]).map(t => (
            <button key={t}
              className={`bot-tab ${activeTab === t ? 'bot-tab--active' : ''}`}
              onClick={() => setActiveTab(t)}>
              {t === 'console' ? 'Consola' : t === 'files' ? 'Archivos' : 'Configuración'}
            </button>
          ))}
        </div>

        {/* Consola */}
        {activeTab === 'console' && (
          <div className="mc-console-wrapper">
            <div className="mc-console-panel">
              <div className="mc-console-header">
                <div className="mc-console-meta">
                  <span className={`status-dot ${STATUS_CLASS[currentStatus]}`} />
                  <span className="mc-console-status">{STATUS_LABEL[currentStatus]}</span>
                  <span className="mc-console-sep">·</span>
                  <span className={`mc-console-ws ${connected ? 'connected' : 'disconnected'}`}>
                    {connected ? 'WS conectado' : 'WS desconectado'}
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={clear}>Limpiar</button>
              </div>

              <div className="mc-console-output" id="bot-console-output">
                {lines.length === 0 ? (
                  <div className="mc-console-empty">
                    {currentStatus === 'running' ? 'Esperando salida del bot...' : 'Inicia el bot para ver su consola'}
                  </div>
                ) : (
                  lines.map(line => (
                    <div key={line.id} className="console-line">{line.text}</div>
                  ))
                )}
              </div>

              <div className="mc-console-input-row">
                <span className="mc-console-prompt">{'>'}</span>
                <input
                  className="mc-console-input"
                  placeholder={currentStatus === 'running' ? 'Escribe un comando...' : 'Bot apagado'}
                  disabled={currentStatus !== 'running'}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      sendCommand((e.target as HTMLInputElement).value)
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Archivos */}
        {activeTab === 'files' && (
          <div className="mcd-tab-content">
            <div className="mcd-section">
              <div className="mcd-breadcrumb">
                <button className="mcd-breadcrumb-item" onClick={() => loadDir('')}>/</button>
                {breadcrumbs.map(c => (
                  <span key={c.p} className="mcd-breadcrumb-sep">
                    <span className="mcd-breadcrumb-slash">/</span>
                    <button className="mcd-breadcrumb-item" onClick={() => ''}>{c.label}</button>
                  </span>
                ))}
              </div>

              <div className="mcd-files-toolbar">
                <button className="mc-btn mc-btn--ghost mc-btn--sm" onClick={goUp} disabled={!path || loadingFiles}>↑ Subir</button>
                <button className="mc-btn mc-btn--ghost mc-btn--sm" onClick={() => loadDir(path)} disabled={loadingFiles}>↺ Actualizar</button>
                <button className="mc-btn mc-btn--primary mc-btn--sm" onClick={() => triggerUpload(false)}>⬆ Subir archivo</button>
                <button className="mc-btn mc-btn--primary mc-btn--sm" onClick={() => triggerUpload(true)}>📂 Subir carpeta</button>
                <span className="mcd-files-count">{files.length} elementos</span>
                <input ref={uploadRef} type="file" hidden multiple onChange={handleUpload} />
              </div>

              {filesError && <div className="mcd-files-error">{filesError}</div>}

              <div className="mcd-files-layout">
                <div>
                  {loadingFiles ? (
                    <div className="mcd-files-list">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="mcd-file-row mcd-file-row--skeleton">
                          <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
                          <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 4 }} />
                          <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mcd-files-list">
                      {files.length === 0 && <div className="mcd-files-empty">Carpeta vacía</div>}
                      {files.map(f => {
                        const full = path ? `${path}/${f.name}` : f.name
                        const isSel = selectedFile === full
                        return (
                          <div key={full}
                            className={`mcd-file-row${f.isDir ? ' mcd-file-row--dir' : ''}${isSel ? ' mcd-file-row--active' : ''}`}>
                            <div className="mcd-file-main" onClick={() => f.isDir && loadDir(full)}>
                              <span className="mcd-file-icon">{f.isDir ? '📁' : '📄'}</span>
                              <span className="mcd-file-name">{f.name}</span>
                            </div>
                            <span className="mcd-file-meta">{f.size !== undefined ? formatBytes(f.size) : '—'}</span>
                            <span className="mcd-file-date">{formatDate(f.mtime)}</span>
                            <div className="mcd-file-actions">
                              {f.isDir ? (
                                <button className="mc-btn mc-btn--ghost mc-btn--sm" onClick={() => loadDir(full)}>Abrir</button>
                              ) : (
                                <button className={`mc-btn mc-btn--sm${isSel ? ' mc-btn--primary' : ' mc-btn--ghost'}`} onClick={() => openFile(full)}>Editar</button>
                              )}
                              <button className="mc-btn mc-btn--danger mc-btn--sm" onClick={() => deletePath(full)}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mcd-editor-panel">
                  {!selectedFile && <><h3 className="mcd-editor-title">Editor de archivos</h3>
                    <p className="mcd-empty-text">Selecciona un archivo de texto de la lista para editarlo.</p></>}
                  {selectedFile && (
                    <>
                      <h3 className="mcd-editor-title">{selectedFile.split('/').pop()}</h3>
                      <p className="mcd-editor-subtitle">{selectedFile}</p>
                      {fileLoading && <div className="mcd-empty-text">Cargando...</div>}
                      {fileError && <div className="mcd-files-error" style={{ marginBottom: 12 }}>{fileError}</div>}
                      {!fileLoading && isBinary && <div className="mcd-empty-text">Archivo binario: no editable desde el panel.</div>}
                      {!fileLoading && !isBinary && (
                        <>
                          <textarea className="mcd-editor-textarea" value={fileContent}
                            spellCheck={false}
                            onChange={e => { setFileContent(e.target.value); setEditorDirty(true); setSavedOk(false) }} />
                          <div className="mcd-editor-actions">
                            <span className={`mcd-editor-status${savedOk ? ' mcd-editor-status--saved' : editorDirty ? ' mcd-editor-status--dirty' : ''}`}>
                              {savedOk ? '✓ Guardado' : editorDirty ? '● Cambios sin guardar' : 'Sin cambios'}
                            </span>
                            <div className="mcd-inline-actions">
                              <button className="mc-btn mc-btn--danger mc-btn--sm" onClick={() => deletePath(selectedFile)} disabled={fileDeleting || fileSaving}>Eliminar</button>
                              <button className="mc-btn mc-btn--primary mc-btn--sm" onClick={saveFile} disabled={fileSaving || fileDeleting}>Guardar</button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuración */}
        {activeTab === 'config' && (
          <div className="bot-config">
            <div className="card bot-config-card">
              <h3 className="bot-form-title">Variables de entorno</h3>
              <p className="bot-config-hint">
                Aquí configuras el token y cualquier variable que tu bot necesite
                (por ejemplo <code>DISCORD_TOKEN</code>). Se guardan en el servidor, cifradas en el archivo <code>.env</code> del bot.
              </p>
              {envRows.map((row, i) => (
                <div key={i} className="bot-env-row">
                  <input className="input" placeholder="CLAVE" value={row.key}
                    onChange={e => { const c = [...envRows]; c[i] = { ...c[i], key: e.target.value }; setEnvRows(c) }} />
                  <input className="input" placeholder="valor" value={row.value}
                    onChange={e => { const c = [...envRows]; c[i] = { ...c[i], value: e.target.value }; setEnvRows(c) }} />
                  <button className="btn btn-ghost btn-icon" onClick={() => setEnvRows(envRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setEnvRows([...envRows, { key: '', value: '' }])}>+ Añadir variable</button>
              <div className="bot-form-actions">
                <button className="btn btn-primary" onClick={saveEnv} disabled={savingEnv}>
                  {savingEnv ? <span className="spinner" /> : 'Guardar variables'}
                </button>
              </div>
            </div>

            <div className="card bot-config-card">
              <h3 className="bot-form-title">Información</h3>
              <div className="bot-info-list">
                <div><span>Origen</span><b>{bot.source === 'git' ? 'Repositorio Git' : 'Archivos subidos'}</b></div>
                {bot.repo && <div><span>Repositorio</span><b>{bot.repo}</b></div>}
                <div><span>Comando</span><b>{bot.runCommand}</b></div>
                <div><span>Autostart</span><b>{bot.autostart ? 'Sí' : 'No'}</b></div>
                <div><span>Creado</span><b>{new Date(bot.createdAt).toLocaleString('es-CL')}</b></div>
              </div>
              {bot.source === 'git' && (
                <button className="btn btn-ghost" onClick={doPull} disabled={pulling} style={{ marginTop: 12 }}>
                  {pulling ? <span className="spinner" /> : '↻ Actualizar desde Git (git pull)'}
                </button>
              )}
            </div>

            <div className="card bot-config-card bot-config-danger">
              <h3 className="bot-form-title">Zona de peligro</h3>
              <p className="bot-config-hint">Elimina el bot y todos sus archivos del servidor. Esta acción no se puede deshacer.</p>
              <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                {deleting ? <span className="spinner" /> : 'Eliminar bot'}
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
