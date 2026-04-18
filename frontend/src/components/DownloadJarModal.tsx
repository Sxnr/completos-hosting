// =========================================================
// DOWNLOAD JAR MODAL — Progreso de descarga del JAR
// Se abre automáticamente cuando falta el JAR al iniciar
// =========================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/download-jar.css'

interface Props {
  instanceId: number
  software:   string
  version:    string
  onDone:     () => void
  onClose:    () => void
}

interface Progress {
  percent: number
  status:  'downloading' | 'done' | 'error'
  message: string
}

export function DownloadJarModal({ instanceId, software, version, onDone, onClose }: Props) {
  const [progress, setProgress] = useState<Progress>({
    percent: 0,
    status:  'downloading',
    message: 'Conectando...',
  })
  const esRef      = useRef<EventSource | null>(null)
  const onDoneRef  = useRef(onDone)
  const onCloseRef = useRef(onClose)

  // Mantiene las refs actualizadas sin re-disparar el useEffect
  useEffect(() => { onDoneRef.current  = onDone  }, [onDone])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const connect = useCallback(() => {
    const token = sessionStorage.getItem('token')
    const base  = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
    const url   = `${base}/api/minecraft/${instanceId}/download-progress`
                + `?software=${encodeURIComponent(software)}`
                + `&version=${encodeURIComponent(version)}`
                + `&token=${encodeURIComponent(token ?? '')}`

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (event) => {
      const data: Progress = JSON.parse(event.data)
      setProgress(data)

      if (data.status === 'done') {
        es.close()
        setTimeout(() => onDoneRef.current(), 800)
      }
      if (data.status === 'error') {
        es.close()
      }
    }

    es.onerror = () => {
      // EventSource reintenta automáticamente — solo marcamos error
      // si llevamos más de 5s sin conectar
      setProgress(prev => ({
        ...prev,
        status:  'error',
        message: 'No se pudo conectar al servidor. Verifica que esté corriendo.',
      }))
      es.close()
    }
  }, [instanceId, software, version])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])

  const isError = progress.status === 'error'
  const isDone  = progress.status === 'done'

  return (
    <div className="djm-overlay" role="dialog" aria-modal="true" aria-label="Descargando servidor">
      <div className="djm-modal">

        {/* Ícono */}
        <div className={`djm-icon ${isError ? 'djm-icon--error' : isDone ? 'djm-icon--done' : ''}`}>
          {isError ? '✕' : isDone ? '✓' : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
        </div>

        {/* Título */}
        <h2 className="djm-title">
          {isError ? 'Error al descargar' : isDone ? '¡Descarga completa!' : 'Descargando servidor'}
        </h2>

        {/* Subtítulo */}
        <p className="djm-subtitle">
          {software.charAt(0).toUpperCase() + software.slice(1)} {version}
        </p>

        {/* Barra de progreso */}
        {!isError && (
          <div className="djm-progress-track" role="progressbar"
            aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`djm-progress-bar ${isDone ? 'djm-progress-bar--done' : ''}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}

        {/* Porcentaje */}
        {!isError && (
          <div className="djm-percent">{progress.percent}%</div>
        )}

        {/* Mensaje */}
        <p className="djm-message">{progress.message}</p>

        {/* Acciones */}
        <div className="djm-actions">
          {isError && (
            <button className="mc-btn mc-btn--primary" onClick={() => onCloseRef.current()}>
              Cerrar
            </button>
          )}
          {!isError && !isDone && (
            <button className="mc-btn mc-btn--ghost mc-btn--sm" onClick={() => onCloseRef.current()}>
              Cancelar
            </button>
          )}
        </div>

      </div>
    </div>
  )
}