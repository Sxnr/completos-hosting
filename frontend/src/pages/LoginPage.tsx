// =========================================================
// LOGIN PAGE — Autenticación JWT + UX de mascota interactiva
// Diseño Glassmorphism de alto contraste con soporte Modo
// Claro/Oscuro. El "Quesi-Cat" sigue al cursor / longitud del
// texto, se tapa los ojos en el campo de contraseña y en el
// login exitoso se desplaza fluidamente hacia el sidebar.
// =========================================================

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion, AnimatePresence, useMotionValue, useSpring,
} from 'framer-motion'
import '../styles/login.css'
import axios from 'axios'
import { login } from '../services/auth'
import { toast } from '../components/Toast'
import { useQuesiCatStore } from '../stores/quesiCatStore'
import { useThemeStore } from '../stores/themeStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)

  const navigate = useNavigate()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Mascota + tema
  const setQuesiEyes = useQuesiCatStore((s) => s.setEyes)
  const setQuesiPose = useQuesiCatStore((s) => s.setPose)
  const setQuesiRevealed = useQuesiCatStore((s) => s.setRevealed)
  const setQuesiMode = useQuesiCatStore((s) => s.setMode)
  const theme = useThemeStore((s) => s.theme)

  // Posición de la mascota con resorte (suave y fluida)
  const catX = useMotionValue(0)
  const catY = useMotionValue(0)
  const springX = useSpring(catX, { stiffness: 120, damping: 15 })
  const springY = useSpring(catY, { stiffness: 120, damping: 15 })

  // ── El gato sigue al cursor ─────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    // Desplazamiento relativo suave respecto al centro del wrapper
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    catX.set(nx * 90)
    catY.set(ny * 90)
    setQuesiPose({ x: nx * 90, y: ny * 90 })
  }, [catX, catY, setQuesiPose])

  // ── El gato sigue la longitud del texto ─────────────────
  const handleUserTyping = useCallback((v: string) => {
    setUsername(v)
    // Cuanto más texto, el gato "se acerca" al campo
    catX.set(Math.min(v.length * 2.5, 60))
    catY.set(8)
    setQuesiPose({ x: Math.min(v.length * 2.5, 60), y: 8 })
  }, [catX, catY, setQuesiPose])

  // ── Ojos: se tapa al enfocar la contraseña ──────────────
  const handlePassFocus = () => setQuesiEyes('closed')
  const handlePassBlur = () => setQuesiEyes('open')

  // ── Submit: anima el reveal y navega ────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(username, password)

      // Marcamos que la mascota ya está revelada: el form
      // se expande y el gato viaja hacia el sidebar
      setQuesiRevealed(true)
      setRevealed(true)

      // Tras la transición, navegamos (login → dashboard)
      setTimeout(() => {
        setQuesiMode('neutral')
        navigate('/')
      }, 900)
    } catch (err: unknown) {
      setLoading(false)
      let msg = 'Usuario o contraseña incorrectos'
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.message || msg
      }
      setError(msg)
      toast.error(msg)
    }
  }

  const isDark = theme === 'dark'

  return (
    <motion.div
      ref={wrapperRef}
      className="login-wrapper"
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Fondo con glow de profundidad — se adapta al tema */}
      <div className="login-bg">
        <div className="login-bg-glow login-bg-glow--top" />
        <div className="login-bg-glow login-bg-glow--bottom" />
      </div>

      {/* Quesi-Cat flotante centrado (sigue cursor/texto) */}
      <motion.div
        className="login-cat"
        style={{ x: springX, y: springY }}
        animate={{
          // Al revelar, el gato viaja hacia arriba (hacia el sidebar)
          y: revealed ? -window.innerHeight / 2 : undefined,
          opacity: revealed ? 0 : 1,
          scale: revealed ? 0.4 : 1,
        }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
      >
        <Cat isDark={isDark} />
      </motion.div>

      <AnimatePresence>
        {!revealed && (
          <motion.div
            key="login-card"
            className="login-card"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 1.4,
              filter: 'blur(12px)',
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          >
            <div className="login-header">
              <motion.div
                className="login-logo"
                whileHover={{ rotate: -6, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M14 4 L18 8 C20 10 22 12 22 16 C22 19 20 21 17 21 L7 21 C4 21 2 19 2 16 C2 12 4 10 6 8 L10 4 L12 6 L14 4 Z"
                    fill="none" />
                  <path d="M3 12 L21 12" />
                </svg>
              </motion.div>
              <h1 className="login-title font-display">Quesito Hosting</h1>
              <p className="login-subtitle">Panel de administración del servidor</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Usuario</label>
                <input
                  id="username"
                  type="text"
                  className="input"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => handleUserTyping(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handlePassFocus}
                  onBlur={handlePassBlur}
                  autoComplete="current-password"
                  required
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    className="login-error"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Iniciando sesión…
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </button>
            </form>

            <p className="login-footer">quesitohosting.shop — v0.4</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pantalla de revelado (login → dashboard) */}
      {revealed && (
        <motion.div
          className="login-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="login-reveal-glow"
            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
          <h2 className="login-reveal-text">Bienvenido, {username || 'admin'} ✦</h2>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── SVG del gato para el login (misma identidad que sidebar) ─
function Cat({ isDark }: { isDark: boolean }) {
  const eyes = useQuesiCatStore((s) => s.eyes)
  const closed = eyes === 'closed'
  const body = isDark ? '#ffb347' : '#e8890f'

  return (
    <svg width="88" height="88" viewBox="0 0 64 64" fill="none">
      <path d="M14 40 C12 28 20 20 32 20 C44 20 52 28 50 40 C50 48 42 54 32 54 C22 54 14 48 14 40 Z" fill={body} />
      <path d="M20 26 L15 12 L28 20 Z" fill={body} />
      <path d="M44 26 L49 12 L36 20 Z" fill={body} />
      {closed ? (
        <g stroke="#2a1804" strokeWidth="2.2" strokeLinecap="round">
          <line x1="22" y1="31" x2="30" y2="31" />
          <line x1="34" y1="31" x2="42" y2="31" />
        </g>
      ) : (
        <g>
          <circle cx="26" cy="30" r="2.8" fill="#2a1804" />
          <circle cx="38" cy="30" r="2.8" fill="#2a1804" />
        </g>
      )}
      <path d="M30 36 L34 36 L32 39 Z" fill="#5a3410" />
    </svg>
  )
}
