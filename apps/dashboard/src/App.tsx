import { useState, useEffect } from 'react';
import { dockerService } from './services/api';

interface Container {
  id: string;
  nombre: string;
  imagen: string;
  estado: string;
}

function App() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    dockerService.getContainers().then(r => setContainers(r.data));
    dockerService.getInfo().then(r => setInfo(r.data));
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', background: '#0d1117', minHeight: '100vh', color: '#e6edf3' }}>
      <h1>🖥️ Completos Hosting</h1>

      {info && (
        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <h2>📊 Sistema</h2>
          <p>Contenedores activos: <strong>{info.contenedores_activos}</strong></p>
          <p>Memoria total: <strong>{info.memoria_total}</strong></p>
          <p>Sistema: <strong>{info.sistema_operativo}</strong></p>
        </div>
      )}

      <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px' }}>
        <h2>🐳 Contenedores</h2>
        {containers.map(c => (
          <div key={c.id} style={{ borderLeft: `4px solid ${c.estado === 'running' ? '#3fb950' : '#f85149'}`, padding: '0.5rem 1rem', marginBottom: '0.5rem' }}>
            <strong>{c.nombre}</strong> — {c.imagen}
            <span style={{ marginLeft: '1rem', color: c.estado === 'running' ? '#3fb950' : '#f85149' }}>
              ● {c.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;