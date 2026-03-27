import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { username, password });
            login(res.data.token, res.data.usuario ?? username);
            navigate('/');
        } catch {
            setError('Usuario o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', position: 'relative', overflow: 'hidden'
        }}>
            {/* Fondo decorativo */}
            <div style={{
                position: 'absolute', width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(88,166,255,0.06) 0%, transparent 70%)',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
            }} />

            <div style={{ width: '100%', maxWidth: '420px', padding: '0 1.5rem', zIndex: 1 }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🖥️</div>
                    <h1 style={{
                        color: '#e6edf3', margin: 0, fontSize: '1.8rem',
                        fontWeight: 'bold', letterSpacing: '-0.5px'
                    }}>
                        Completos Hosting
                    </h1>
                    <p style={{ color: '#8b949e', margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
                        Panel de Administración
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.4)'
                }}>
                    <h2 style={{
                        color: '#e6edf3', margin: '0 0 1.5rem',
                        fontSize: '1rem', fontWeight: 'normal'
                    }}>
                        Inicia sesión para continuar
                    </h2>

                    <form onSubmit={handleLogin}>
                        {/* Campo Usuario */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', color: '#8b949e', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                                USUARIO
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{
                                    position: 'absolute', left: '0.75rem', top: '50%',
                                    transform: 'translateY(-50%)', color: '#8b949e', fontSize: '0.9rem'
                                }}>👤</span>
                                <input
                                    type="text"
                                    placeholder="tu_usuario"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    style={{
                                        width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem',
                                        background: '#0d1117', border: '1px solid #30363d',
                                        borderRadius: '8px', color: '#e6edf3', fontSize: '0.9rem',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.15s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#58a6ff'}
                                    onBlur={e => e.target.style.borderColor = '#30363d'}
                                />
                            </div>
                        </div>

                        {/* Campo Contraseña */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: '#8b949e', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                                CONTRASEÑA
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{
                                    position: 'absolute', left: '0.75rem', top: '50%',
                                    transform: 'translateY(-50%)', color: '#8b949e', fontSize: '0.9rem'
                                }}>🔒</span>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem',
                                        background: '#0d1117', border: '1px solid #30363d',
                                        borderRadius: '8px', color: '#e6edf3', fontSize: '0.9rem',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.15s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#58a6ff'}
                                    onBlur={e => e.target.style.borderColor = '#30363d'}
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                                borderRadius: '8px', padding: '0.6rem 0.75rem',
                                color: '#f85149', fontSize: '0.82rem', marginBottom: '1.2rem'
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '0.8rem',
                                background: loading ? '#21262d' : 'linear-gradient(135deg, #238636, #2ea043)',
                                color: loading ? '#8b949e' : '#fff',
                                border: 'none', borderRadius: '8px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '0.95rem', fontWeight: 'bold',
                                fontFamily: 'monospace', letterSpacing: '0.5px',
                                transition: 'all 0.15s',
                                boxShadow: loading ? 'none' : '0 4px 12px rgba(35,134,54,0.3)'
                            }}
                        >
                            {loading ? '⏳ Iniciando sesión...' : '→ Iniciar sesión'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', color: '#484f58', fontSize: '0.75rem', marginTop: '1.5rem' }}>
                    Completos Hosting v0.2 · Acceso restringido
                </p>
            </div>
        </div>
    );
}