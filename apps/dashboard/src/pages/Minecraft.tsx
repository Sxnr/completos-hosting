import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface MCServer {
  id: string; nombre: string; version: string;
  memoria: string; estado: string; puerto: number | null; creado: string;
}
interface CreateForm { nombre: string; version: string; memoria: string; puerto: string; }

const styles = `
  @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  .mc-card{transition:transform .2s ease,box-shadow .2s ease}
  .mc-card:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,.4)!important}
  .mc-btn{transition:all .15s ease}
  .mc-btn:hover:not(:disabled){transform:translateY(-1px)}
  .mc-btn:active:not(:disabled){transform:translateY(0)}
  .overlay{animation:fadeIn .15s ease}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal{animation:slideUp .2s ease}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  input:focus,select:focus{border-color:#58a6ff!important}
`;

const MC_VERSIONS = ['1.21.4','1.21.1','1.20.6','1.20.4','1.20.1','1.19.4','1.18.2','1.17.1','1.16.5','1.12.2','1.8.9'];
const MC_MEMORY   = ['512M','1G','2G','3G','4G','6G','8G'];

export default function Minecraft() {
  const [servers,    setServers]    = useState<MCServer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [actionId,   setActionId]   = useState<string|null>(null);
  const [logs,       setLogs]       = useState<{id:string;content:string}|null>(null);
  const [error,      setError]      = useState('');
  const [form, setForm] = useState<CreateForm>({ nombre:'', version:'1.20.4', memoria:'2G', puerto:'25565' });

  const fetchServers = useCallback(async () => {
    try { const r = await api.get('/minecraft'); setServers(r.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchServers(); const t = setInterval(fetchServers, 5000); return () => clearInterval(t); }, [fetchServers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError('');
    try {
      await api.post('/minecraft/create', { nombre: form.nombre, version: form.version, memoria: form.memoria, puerto: Number(form.puerto) });
      setShowCreate(false); setForm({ nombre:'', version:'1.20.4', memoria:'2G', puerto:'25565' }); await fetchServers();
    } catch (err: any) { setError(err.response?.data?.error || 'Error al crear el servidor'); }
    finally { setCreating(false); }
  };

  const handleAction = async (id: string, action: 'start'|'stop'|'restart'|'delete') => {
    if (action === 'delete' && !confirm('¿Eliminar este servidor? Esta acción no se puede deshacer.')) return;
    setActionId(`${id}-${action}`);
    try {
      action === 'delete' ? await api.delete(`/minecraft/${id}`) : await api.post(`/minecraft/${id}/${action}`);
      await fetchServers();
    } catch (err: any) { alert(err.response?.data?.error || `Error: ${action}`); }
    finally { setActionId(null); }
  };

  const handleLogs = async (id: string) => {
    try { const r = await api.get(`/minecraft/${id}/logs`); setLogs({ id, content: r.data.logs }); }
    catch { alert('Error al obtener los logs'); }
  };

  const isRunning = (s: MCServer) => s.estado === 'running';
  const inp: React.CSSProperties = { width:'100%', padding:'10px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'14px', fontFamily:'monospace', outline:'none', boxSizing:'border-box', transition:'border-color .15s' };
  const lbl: React.CSSProperties = { display:'block', color:'#8b949e', fontSize:'11px', fontFamily:'monospace', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' };

  return (
    <>
      <style>{styles}</style>
      <div style={{ padding:'28px', maxWidth:'1200px', display:'flex', flexDirection:'column', gap:'24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', animation:'fadeInUp .4s ease' }}>
          <div>
            <h1 style={{ color:'#f9fafb', fontSize:'26px', fontWeight:700, margin:0, fontFamily:'monospace' }}>Servidores Minecraft</h1>
            <p style={{ color:'#6b7280', fontSize:'13px', marginTop:'4px', fontFamily:'monospace' }}>
              {servers.filter(s=>isRunning(s)).length} online · {servers.filter(s=>!isRunning(s)).length} offline · actualiza cada 5s
            </p>
          </div>
          <button className="mc-btn" onClick={() => setShowCreate(true)} style={{ background:'linear-gradient(135deg,#238636,#2ea043)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer', fontFamily:'monospace', boxShadow:'0 4px 12px rgba(35,134,54,.3)' }}>
            + Nuevo Servidor
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'16px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height:'180px', borderRadius:'12px', background:'linear-gradient(90deg,#161b22 25%,#1f2937 50%,#161b22 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div style={{ background:'linear-gradient(135deg,#1e2535,#161b27)', border:'1px solid #2d3748', borderRadius:'16px', padding:'4rem 2rem', textAlign:'center', animation:'fadeInUp .4s ease .1s both' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>⛏️</div>
            <h3 style={{ color:'#e6edf3', fontFamily:'monospace', margin:'0 0 .5rem' }}>Sin servidores aún</h3>
            <p style={{ color:'#6b7280', fontFamily:'monospace', fontSize:'13px', margin:'0 0 1.5rem' }}>Crea tu primer servidor de Minecraft Vanilla</p>
            <button className="mc-btn" onClick={() => setShowCreate(true)} style={{ background:'#238636', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'14px', cursor:'pointer', fontFamily:'monospace' }}>
              + Crear primer servidor
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'16px' }}>
            {servers.map((s, i) => (
              <div key={s.id} className="mc-card" style={{ background:'linear-gradient(135deg,#1e2535,#161b27)', border:'1px solid #2d3748', borderRadius:'12px', padding:'20px', boxShadow:'0 4px 16px rgba(0,0,0,.3)', animation:`fadeInUp .4s ease ${i*.07}s both` }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'9px', height:'9px', borderRadius:'50%', background: isRunning(s)?'#34d399':'#f87171', animation: isRunning(s)?'pulse-dot 2s infinite':'none', boxShadow: isRunning(s)?'0 0 8px #34d399':'0 0 8px #f87171', flexShrink:0, marginTop:'3px' }} />
                    <div>
                      <div style={{ color:'#f9fafb', fontWeight:700, fontFamily:'monospace', fontSize:'15px' }}>{s.nombre}</div>
                      <div style={{ color:'#4b5563', fontFamily:'monospace', fontSize:'11px', marginTop:'2px' }}>ID: {s.id}</div>
                    </div>
                  </div>
                  <span style={{ background: isRunning(s)?'#064e3b':'#450a0a', color: isRunning(s)?'#34d399':'#f87171', fontSize:'11px', padding:'3px 10px', borderRadius:'20px', fontWeight:600, fontFamily:'monospace' }}>
                    {isRunning(s) ? 'online' : 'offline'}
                  </span>
                </div>
                <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
                  {[{l:'Versión',v:s.version,c:'#60a5fa'},{l:'RAM',v:s.memoria,c:'#a78bfa'},{l:'Puerto',v:s.puerto?`:${s.puerto}`:'N/A',c:'#fbbf24'}].map(x => (
                    <div key={x.l} style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'6px', padding:'6px 10px', flex:1 }}>
                      <div style={{ color:'#4b5563', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em' }}>{x.l}</div>
                      <div style={{ color:x.c, fontSize:'13px', fontFamily:'monospace', fontWeight:600, marginTop:'2px' }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {!isRunning(s) ? (
                    <button className="mc-btn" disabled={actionId===`${s.id}-start`} onClick={() => handleAction(s.id,'start')} style={{ flex:1, padding:'8px 0', background:'#064e3b', color:'#34d399', border:'1px solid #065f46', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                      {actionId===`${s.id}-start`?'...':'▶ Iniciar'}
                    </button>
                  ) : (
                    <>
                      <button className="mc-btn" disabled={actionId===`${s.id}-stop`} onClick={() => handleAction(s.id,'stop')} style={{ flex:1, padding:'8px 0', background:'#450a0a', color:'#f87171', border:'1px solid #7f1d1d', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                        {actionId===`${s.id}-stop`?'...':'■ Detener'}
                      </button>
                      <button className="mc-btn" disabled={actionId===`${s.id}-restart`} onClick={() => handleAction(s.id,'restart')} style={{ flex:1, padding:'8px 0', background:'#1c2d40', color:'#60a5fa', border:'1px solid #1d4ed8', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                        {actionId===`${s.id}-restart`?'...':'↺ Reiniciar'}
                      </button>
                    </>
                  )}
                  <button className="mc-btn" onClick={() => handleLogs(s.id)} title="Ver logs" style={{ padding:'8px 12px', background:'#1f2937', color:'#9ca3af', border:'1px solid #374151', borderRadius:'6px', fontSize:'12px', cursor:'pointer' }}>📋</button>
                  <button className="mc-btn" disabled={actionId===`${s.id}-delete`} onClick={() => handleAction(s.id,'delete')} title="Eliminar" style={{ padding:'8px 12px', background:'#1f2937', color:'#6b7280', border:'1px solid #374151', borderRadius:'6px', fontSize:'12px', cursor:'pointer' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL CREAR */}
        {showCreate && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setShowCreate(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 64px rgba(0,0,0,.6)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
                <h2 style={{ color:'#f9fafb', margin:0, fontFamily:'monospace', fontSize:'18px', fontWeight:700 }}>⛏️ Nuevo Servidor Vanilla</h2>
                <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
              </div>
              <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div>
                  <label style={lbl}>Nombre del servidor</label>
                  <input type="text" required placeholder="Mi-Servidor-MC" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Versión de Minecraft</label>
                  <select value={form.version} onChange={e => setForm(f=>({...f,version:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                    {MC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={lbl}>RAM</label>
                    <select value={form.memoria} onChange={e => setForm(f=>({...f,memoria:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                      {MC_MEMORY.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Puerto</label>
                    <input type="number" required min="1024" max="65535" placeholder="25565" value={form.puerto} onChange={e => setForm(f=>({...f,puerto:e.target.value}))} style={inp} />
                  </div>
                </div>
                <div style={{ background:'#0d1117', border:'1px solid #1f2937', borderRadius:'8px', padding:'12px', fontSize:'12px', fontFamily:'monospace', color:'#6b7280', lineHeight:'1.7' }}>
                  ℹ️ Servidor <span style={{color:'#60a5fa'}}>Vanilla {form.version}</span> · <span style={{color:'#a78bfa'}}>{form.memoria}</span> RAM · Puerto <span style={{color:'#fbbf24'}}>{form.puerto}</span><br/>
                  La primera vez descarga el servidor (~50MB) y puede tardar 1-2 min.
                </div>
                {error && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 12px', color:'#f85149', fontSize:'13px', fontFamily:'monospace' }}>⚠️ {error}</div>}
                <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ flex:1, padding:'10px', background:'#21262d', color:'#8b949e', border:'1px solid #30363d', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'monospace' }}>Cancelar</button>
                  <button type="submit" disabled={creating} className="mc-btn" style={{ flex:2, padding:'10px', background: creating?'#21262d':'linear-gradient(135deg,#238636,#2ea043)', color: creating?'#6b7280':'#fff', border:'none', borderRadius:'8px', cursor: creating?'not-allowed':'pointer', fontSize:'14px', fontWeight:700, fontFamily:'monospace' }}>
                    {creating ? '⏳ Creando servidor...' : '🚀 Crear servidor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL LOGS */}
        {logs && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setLogs(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'12px', width:'100%', maxWidth:'820px', maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.7)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #21262d' }}>
                <span style={{ color:'#34d399', fontFamily:'monospace', fontSize:'14px', fontWeight:600 }}>📋 Logs — {logs.id}</span>
                <button onClick={() => setLogs(null)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
              </div>
              <pre style={{ margin:0, padding:'16px 20px', overflow:'auto', color:'#e6edf3', fontFamily:'monospace', fontSize:'12px', lineHeight:'1.6', flex:1 }}>
                {logs.content || 'Sin logs disponibles aún...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
}