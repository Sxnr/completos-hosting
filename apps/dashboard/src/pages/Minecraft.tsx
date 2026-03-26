export default function Minecraft() {
    return (
        <div>
            <h1 style={{ color: '#e6edf3', fontFamily: 'monospace' }}>🎮 Servidores Minecraft</h1>
            <div style={{
                background: '#161b22', border: '1px solid #21262d',
                borderRadius: '8px', padding: '3rem', color: '#8b949e',
                textAlign: 'center', fontFamily: 'monospace'
            }}>
                <p style={{ fontSize: '3rem', margin: 0 }}>🚧</p>
                <p style={{ fontSize: '1rem' }}>Módulo en desarrollo — v0.3</p>
                <p style={{ fontSize: '0.8rem' }}>Crear, iniciar y gestionar servidores de Minecraft como contenedores Docker</p>
            </div>
        </div>
    );
}