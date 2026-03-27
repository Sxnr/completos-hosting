import { useEffect, useState } from 'react';
import api from '../services/api';

interface Contenedor {
    id: string;
    nombre: string;
    imagen: string;
    estado: string;
}

interface SistemaInfo {
    contenedoresActivos: number;
    memoriaTotal: string;
    sistemaOperativo: string;
}

export default function Dashboard() {
    const [contenedores, setContenedores] = useState<Contenedor[]>([]);
    const [sistema, setSistema] = useState<SistemaInfo | null>(null);

    useEffect(() => {
        api.get('/docker/containers').then(res => setContenedores(res.data));
        api.get('/docker/info').then(res => setSistema(res.data));
    }, []);

    return (
        <div style={{ fontFamily: 'monospace' }}>
            <h1 style={{ color: '#e6edf3', marginBottom: '1.5rem' }}>📊 Dashboard</h1>

            {/* Sistema */}
            {sistema && (
                <div style={{
                    background: '#161b22', border: '1px solid #21262d',
                    borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem'
                }}>
                    <h2 style={{ color: '#e6edf3', margin: '0 0 1rem', fontSize: '1rem' }}>📦 Sistema</h2>
                    <p style={{ color: '#8b949e', margin: '0.3rem 0' }}>
                        Contenedores activos: <span style={{ color: '#58a6ff' }}>{sistema.contenedoresActivos}</span>
                    </p>
                    <p style={{ color: '#8b949e', margin: '0.3rem 0' }}>
                        Memoria total: <span style={{ color: '#58a6ff' }}>{sistema.memoriaTotal}</span>
                    </p>
                    <p style={{ color: '#8b949e', margin: '0.3rem 0' }}>
                        Sistema: <span style={{ color: '#58a6ff' }}>{sistema.sistemaOperativo}</span>
                    </p>
                </div>
            )}

            {/* Contenedores */}
            <div style={{
                background: '#161b22', border: '1px solid #21262d',
                borderRadius: '8px', padding: '1.5rem'
            }}>
                <h2 style={{ color: '#e6edf3', margin: '0 0 1rem', fontSize: '1rem' }}>🐳 Contenedores</h2>
                {contenedores.map(c => (
                    <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.6rem 0', borderBottom: '1px solid #21262d'
                    }}>
                        <span style={{ color: '#e6edf3' }}>{c.nombre}</span>
                        <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>{c.imagen}</span>
                        <span style={{
                            color: c.estado === 'running' ? '#3fb950' : '#f85149',
                            fontSize: '0.8rem'
                        }}>● {c.estado}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}