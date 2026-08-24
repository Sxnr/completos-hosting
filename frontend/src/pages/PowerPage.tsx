// =========================================================
// POWER PAGE — Control remoto de encendido/apagado
// =========================================================

import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { getPowerStatus, powerOn, powerOff } from '../services/power'
import type { PowerStatus } from '../services/power'
import { getStoredUser } from '../services/auth'
import '../styles/power.css'

export default function PowerPage() {
  const user = getStoredUser()
  const isAdmin = user?.role === 'admin'

  const [status, setStatus]   = useState<PowerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<'on' | 'off' | null>(null)
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)

  const loadStatus = async () => {
    try {
      const s = await getPowerStatus()
      setStatus(s)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  const handleOn = async () => {
    setBusy('on')
    setFeedback(null)
    try {
      const res = await powerOn()
      setFeedback({ msg: res.message, ok: true })
    } catch (e: any) {
      setFeedback({ msg: e?.response?.data?.message || 'Error al encender', ok: false })
    } finally {
      setBusy(null)
    }
  }

  const handleOff = async () => {
    setBusy('off')
    setFeedback(null)
    setConfirmOff(false)
    try {
      const res = await powerOff()
      setFeedback({ msg: res.message + ' — esta página dejará de responder.', ok: true })
    } catch (e: any) {
      setFeedback({ msg: e?.response?.data?.message || 'Error al apagar', ok: false })
    } finally {
      setBusy(null)
    }
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="dashboard-content">
          <div className="page-header">
            <h1 className="page-title">Control de energía</h1>
          </div>
          <div className="login-error">
            Solo los administradores pueden controlar el servidor físico.
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        <div className="page-header">
          <div>
            <h1 className="page-title">Control de energía</h1>
            <p className="page-subtitle">
              Encendido remoto (Wake-on-LAN) y apagado del servidor físico
            </p>
          </div>
        </div>

        {feedback && (
          <div className={`power-feedback ${feedback.ok ? 'power-feedback--ok' : 'power-feedback--error'}`}>
            {feedback.msg}
          </div>
        )}

        <div className="power-grid">

          <div className="power-card card">
            <span className="power-card-title">Estado del control</span>
            {loading || !status ? (
              <span className="power-muted">Cargando…</span>
            ) : (
              <div className="power-state">
                <span className={`badge ${status.enabled ? 'badge-online' : 'badge-offline'}`}>
                  {status.enabled ? `Activo (${status.driver})` : 'Deshabilitado'}
                </span>
                <span className="power-muted">
                  Encendido: {status.supportsOn ? 'disponible' : 'no configurado'} ·
                  Apagado vía {status.offVia === 'os' ? 'sistema' : 'dispositivo'}
                </span>
              </div>
            )}
          </div>

          <div className="power-card card">
            <span className="power-card-title">Encender servidor</span>
            <p className="power-muted">
              Envía un paquete Wake-on-LAN a la tarjeta de red para arrancar el equipo.
            </p>
            <button
              className="btn btn-primary power-btn"
              onClick={handleOn}
              disabled={busy !== null || (status ? !status.supportsOn : false)}
            >
              {busy === 'on' ? <><span className="spinner" /> Enviando…</> : '⏻ Encender'}
            </button>
          </div>

          <div className="power-card card">
            <span className="power-card-title">Apagar servidor</span>
            <p className="power-muted">
              Ejecuta el apagado del sistema operativo del host de forma segura.
            </p>
            {!confirmOff ? (
              <button
                className="btn btn-danger power-btn"
                onClick={() => setConfirmOff(true)}
                disabled={busy !== null}
              >
                ⏻ Apagar
              </button>
            ) : (
              <div className="power-confirm">
                <span className="power-confirm-text">¿Seguro? Se cerrará todo.</span>
                <div className="power-confirm-actions">
                  <button className="btn btn-danger" onClick={handleOff} disabled={busy === 'off'}>
                    {busy === 'off' ? 'Apagando…' : 'Sí, apagar'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmOff(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  )
}
