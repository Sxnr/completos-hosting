// =========================================================
// ERROR BOUNDARY — Evita que un error de render tumbe toda la app
// =========================================================

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Error desconocido' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, info)
  }

  handleBack = () => {
    this.setState({ hasError: false, message: '' })
    window.history.back()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 24,
          background: 'var(--color-bg)', color: 'var(--color-text)',
        }}>
          <div style={{
            maxWidth: 480, textAlign: 'center', padding: '32px',
            background: 'var(--color-surface)', border: '1px solid var(--glass-border)',
            borderRadius: 16,
          }}>
            <h2 style={{ marginTop: 0 }}>Ups, algo salió mal</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
            <button className="btn btn-primary" onClick={this.handleBack} style={{ marginTop: 12 }}>
              Volver
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
