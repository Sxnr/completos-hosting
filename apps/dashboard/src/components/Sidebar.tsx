import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
    { path: '/',           icon: '📊', label: 'Dashboard'     },
    { path: '/minecraft',  icon: '🎮', label: 'Minecraft'     },
    { path: '/databases',  icon: '🗄️', label: 'Bases de Datos' },
    { path: '/hosting',    icon: '🌐', label: 'Web Hosting'   },
    { path: '/monitoring', icon: '📈', label: 'Monitoreo'     },
];

export default function Sidebar() {
    const { usuario, logout } = useAuth();

    return (
        <aside style={{
            width: '220px', minHeight: '100vh', background: '#0d1117',
            borderRight: '1px solid #21262d', display: 'flex',
            flexDirection: 'column', padding: '1rem 0', fontFamily: 'monospace'
        }}>
            <div style={{ padding: '0 1rem 1.5rem', borderBottom: '1px solid #21262d' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e6edf3' }}>
                    🖥️ Completos
                </div>
                <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>Hosting Platform</div>
            </div>

            <nav style={{ flex: 1, padding: '1rem 0' }}>
                {NAV_ITEMS.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            padding: '0.6rem 1rem', textDecoration: 'none',
                            color: isActive ? '#58a6ff' : '#8b949e',
                            background: isActive ? '#161b22' : 'transparent',
                            borderLeft: isActive ? '2px solid #58a6ff' : '2px solid transparent',
                            fontSize: '0.85rem', transition: 'all 0.15s'
                        })}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '1rem', borderTop: '1px solid #21262d' }}>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    👤 {usuario ?? 'Usuario'}
                </div>
                <button onClick={logout} style={{
                    width: '100%', padding: '0.4rem', background: '#21262d',
                    color: '#f85149', border: '1px solid #30363d', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '0.75rem'
                }}>
                    Cerrar sesión
                </button>
            </div>
        </aside>
    );
}