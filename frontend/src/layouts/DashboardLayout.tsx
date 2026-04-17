// =========================================================
// DASHBOARD LAYOUT — Layout principal con sidebar
// Envuelve todas las páginas que requieren autenticación
// =========================================================

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/sidebar.css'

// ── Definición de los módulos de navegación ──────────────
// Cada módulo tiene un ícono SVG, nombre, ruta y si está disponible
const NAV_ITEMS = [
  {
    id: 'overview', label: 'Overview', path: '/', available: true,
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
    id: 'processes', label: 'Procesos', path: '/processes', available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'minecraft', label: 'Minecraft', path: '/minecraft', available: false,
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
    id: 'databases', label: 'Bases de Datos', path: '/databases', available: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    id: 'webhosting', label: 'Web Hosting', path: '/webhosting', available: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    id: 'monitoring', label: 'Monitoreo', path: '/monitoring', available: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
  },
  {
  id: 'settings', label: 'Configuración', path: '/settings', available: true,
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
},
]

// ── Íconos de la barra inferior del sidebar ──────────────
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

// ── Props del layout ──────────────────────────────────────
interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate  = useNavigate()
  const location  = useLocation()

  // Controla si el sidebar está colapsado o expandido
  const [collapsed, setCollapsed] = useState(false)

  // ── Cerrar sesión ───────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('token')
    navigate('/login')
  }

  // ── Navegar solo si el módulo está disponible ───────────
  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    if (item.available) navigate(item.path)
  }

  return (
    <div className={`dashboard-root ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Logo y botón de colapso */}
        <div className="sidebar-header">
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="3" width="20" height="5" rx="2"/>
                  <rect x="2" y="10" width="20" height="5" rx="2"/>
                  <rect x="2" y="17" width="20" height="5" rx="2"/>
                </svg>
              </div>
              <span className="sidebar-brand-name">Completos</span>
            </div>
          )}
          {/* Botón para colapsar/expandir el sidebar */}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed
                ? <polyline points="9 18 15 12 9 6"/>   // Flecha derecha — expandir
                : <polyline points="15 18 9 12 15 6"/>  // Flecha izquierda — colapsar
              }
            </svg>
          </button>
        </div>

        {/* Navegación principal */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item
                ${location.pathname === item.path ? 'active' : ''}
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
              {/* Badge "Pronto" para módulos no disponibles */}
              {!collapsed && !item.available && (
                <span className="sidebar-item-soon">Pronto</span>
              )}
            </button>
          ))}
        </nav>

        {/* Parte inferior: settings y logout */}
        <div className="sidebar-footer">
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

          {/* Botón de cerrar sesión */}
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

      {/* ── Contenido principal ──────────────────────────── */}
      <main className="dashboard-main">
        {children}
      </main>

    </div>
  )
}