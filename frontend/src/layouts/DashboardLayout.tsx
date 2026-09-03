// =========================================================
// DASHBOARD LAYOUT — Layout principal con sidebar
// Incluye: tema dual (claro/oscuro), mascota Quesi-Cat
// interactiva, y transiciones Framer Motion entre módulos.
// =========================================================

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import '../styles/sidebar.css'
import ConnectionStatus from '../components/ConnectionStatus'
import QuesiCat from '../components/QuesiCat'
import { useQuesiCatStore } from '../stores/quesiCatStore'
import { useThemeStore } from '../stores/themeStore'

// ── Definición de los módulos de navegación ──────────────
const NAV_ITEMS = [
  {
    id: 'overview', label: 'Overview', path: '/',
    catMode: 'neutral' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'processes', label: 'Procesos', path: '/processes',
    catMode: 'neutral' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'minecraft', label: 'Minecraft', path: '/minecraft',
    catMode: 'minecraft' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.29 7 12 12 20.71 7"/>
        <line x1="12" y1="22" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'bots', label: 'Bots', path: '/bots',
    catMode: 'bots' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
      </svg>
    ),
  },
  {
    id: 'power', label: 'Energía', path: '/power',
    catMode: 'neutral' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    id: 'webhosting', label: 'Web Hosting', path: '/web',
    catMode: 'neutral' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    id: 'monitoring', label: 'Monitoreo', path: '/monitoring',
    catMode: 'neutral' as const, available: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
  },
  {
    id: 'databases', label: 'Bases de Datos', path: '/databases',
    catMode: 'neutral' as const, available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
]

// ── Íconos de la barra inferior ───────────────────────────
const BOTTOM_ITEMS = [
  {
    id: 'settings',
    label: 'Configuración',
    path: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    available: true,
  },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [collapsed, setCollapsed] = useState(false)

  // Tema global
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)

  // Mascota: modo según ruta activa
  const setCatMode = useQuesiCatStore((s) => s.setMode)
  const catRevealed = useQuesiCatStore((s) => s.revealed)

  // ── Sincronizar el modo del gato con la ruta ────────────
  useEffect(() => {
    const current = NAV_ITEMS.find(
      (item) =>
        location.pathname === item.path ||
        (item.path !== '/' && location.pathname.startsWith(item.path)),
    )
    if (current?.available) setCatMode(current.catMode)
  }, [location.pathname, setCatMode])

  // ── Cerrar sesión ───────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('token')
    navigate('/login')
  }

  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    if (item.available) navigate(item.path)
  }

  return (
    <div className={`dashboard-root ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 4 L18 8 C20 10 22 12 22 16 C22 19 20 21 17 21 L7 21 C4 21 2 19 2 16 C2 12 4 10 6 8 L10 4 L12 6 L14 4 Z" />
                </svg>
              </div>
              <span className="sidebar-brand-name font-display">Quesito Hosting</span>
            </div>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed
                ? <polyline points="9 18 15 12 9 6"/>
                : <polyline points="15 18 9 12 15 6"/>
              }
            </svg>
          </button>
        </div>

        {/* Mascota Quesi-Cat — estado según ruta */}
        {!collapsed && (
          <motion.div
            className="sidebar-cat"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: catRevealed ? 1 : 0.4, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <QuesiCat />
          </motion.div>
        )}

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item
                ${location.pathname === item.path
                  || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}
                ${!item.available ? 'disabled' : ''}
              `}
              onClick={() => handleNav(item)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-item-label">{item.label}</span>
              )}
              {!collapsed && !item.available && (
                <span className="sidebar-item-soon">Pronto</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ConnectionStatus collapsed={collapsed} />

          {BOTTOM_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-item-label">{item.label}</span>
              )}
            </button>
          ))}

          {/* Botón de cambio de tema (claro/oscuro) */}
          <button
            className="sidebar-item sidebar-item--theme"
            onClick={toggleTheme}
            title={collapsed ? 'Cambiar tema' : undefined}
            aria-label="Cambiar tema"
          >
            <span className="sidebar-item-icon">
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </span>
            {!collapsed && (
              <span className="sidebar-item-label">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
            )}
          </button>

          <button
            className="sidebar-item sidebar-item--logout"
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            aria-label="Cerrar sesión"
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            {!collapsed && (
              <span className="sidebar-item-label">Cerrar sesión</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal con transición de entrada ── */}
      <motion.main
        key={location.pathname}
        className="dashboard-main"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>

    </div>
  )
}
