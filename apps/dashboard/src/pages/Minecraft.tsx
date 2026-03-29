import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface MCServer {
  id: string; nombre: string; version: string;
  memoria: string; estado: string; puerto: number | null; creado: string;
}
interface MCStats {
  cpuPercent: number; memUsage: number; memLimit: number;
  netIn: number; netOut: number; uptime: number; running: boolean;
}
interface MCPlayers { players: string[]; ready: boolean; maxPlayers: number; }
interface ServerExtra { stats?: MCStats; players?: MCPlayers; }
interface CreateForm { nombre: string; version: string; memoria: string; puerto: string; }

const MC_VERSIONS = ['1.21.4','1.21.1','1.20.6','1.20.4','1.20.1','1.19.4','1.18.2','1.17.1','1.16.5','1.12.2','1.8.9'];
const MC_MEMORY   = ['512M','1G','2G','3G','4G','6G','8G'];

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)} MB`;
  return `${(bytes/1073741824).toFixed(2)} GB`;
}
function fmtUptime(ms: number) {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}d ${h%24}h`;
  if (h > 0) return `${h}h ${m%60}m`;
  if (m > 0) return `${m}m ${s%60}s`;
  return `${s}s`;
}

const css = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .mc-card{transition:transform .2s,box-shadow .2s;cursor:default}
  .mc-card:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,.5)!important}
  .mc-btn{transition:all .15s}.mc-btn:hover:not(:disabled){transform:translateY(-1px)}
  .mc-btn:active:not(:disabled){transform:translateY(0)}
  .fade-up{animation:fadeUp .35s ease both}
  .overlay{animation:fadeUp .15s ease}
  .modal{animation:fadeUp .2s ease}
  input:focus,select:focus{border-color:#58a6ff!important;outline:none}
`;

export default function Minecraft() {
  const [servers,    setServers]    = useState<MCServer[]>([]);
  const [extras,     setExtras]     = useState<Record<string,ServerExtra>>({});
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [actionId,   setActionId]   = useState<string|null>(null);
  const [logs,       setLogs]       = useState<{id:string;content:string}|null>(null);
  const [error,      setError]      = useState('');
  const [form, setForm] = useState<CreateForm>({nombre:'',version:'1.20.4',memoria:'2G',puerto:'25565'});

  const fetchServers = useCallback(async () => {
    try { const r = await api.get('/minecraft'); setServers(r.data); }
    catch {} finally { setLoading(false); }
  }, []);

  const fetchExtras = useCallback(async (srv: MCServer[]) => {
    const running = srv.filter(s => s.estado === 'running');
    await Promise.all(running.map(async s => {
      try {
        const [statsR, playersR] = await Promise.all([
          api.get(`/minecraft/${s.id}/stats`),
          api.get(`/minecraft/${s.id}/players`)
        ]);
        setExtras(prev => ({ ...prev, [s.id]: { stats: statsR.data, players: playersR.data } }));
      } catch {}
    }));
  }, []);

  useEffect(() => {
    fetchServers();
    const t = setInterval(async () => {
      await fetchServers();
      setServers(cur => { fetchExtras(cur); return cur; });
    }, 5000);
    return () => clearInterval(t);
  }, [fetchServers, fetchExtras]);

  useEffect(() => { if (servers.length) fetchExtras(servers); }, [servers.length]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError('');
    try {
      await api.post('/minecraft/create', { nombre: form.nombre, version: form.version, memoria: form.memoria, puerto: Number(form.puerto) });
      setShowCreate(false); setForm({nombre:'',version:'1.20.4',memoria:'2G',puerto:'25565'});
      await fetchServers();
    } catch (err: any) { setError(err.response?.data?.error || 'Error al crear'); }
    finally { setCreating(false); }
  };

  const handleAction = async (id: string, action: 'start'|'stop'|'restart'|'delete') => {
    if (action === 'delete' && !confirm('¿Eliminar este servidor? No se puede deshacer.')) return;
    setActionId(`${id}-${action}`);
    try {
      action === 'delete' ? await api.delete(`/minecraft/${id}`) : await api.post(`/minecraft/${id}/${action}`);
      await fetchServers();
    } catch (err: any) { alert(err.response?.data?.error || `Error: ${action}`); }
    finally { setActionId(null); }
  };

  const handleLogs = async (id: string) => {
    try { const r = await api.get(`/minecraft/${id}/logs`); setLogs({ id, content: r.data.logs }); }
    catch { alert('Error al obtener logs'); }
  };

  const isRunning = (s: MCServer) => s.estado === 'running';
  const inp: React.CSSProperties = { width:'100%', padding:'10px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'14px', fontFamily:'monospace', boxSizing:'border-box', transition:'border-color .15s' };
  const lbl: React.CSSProperties = { display:'block', color:'#8b949e', fontSize:'11px', fontFamily:'monospace', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' };

  return (
    <>
      <style>{css}</style>
      <div style={{ padding:'28px', maxWidth:'1280px', display:'flex', flexDirection:'column', gap:'24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }} className="fade-up">
          <div>
            <h1 style={{ color:'#f9fafb', fontSize:'26px', fontWeight:700, margin:0, fontFamily:'monospace' }}>Servidores Minecraft</h1>
            <p style={{ color:'#6b7280', fontSize:'13px', marginTop:'4px', fontFamily:'monospace' }}>
              {servers.filter(s=>isRunning(s)).length} online · {servers.filter(s=>!isRunning(s)).length} offline · stats cada 5s
            </p>
          </div>
          <button className="mc-btn" onClick={() => setShowCreate(true)} style={{ background:'#238636', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer', fontFamily:'monospace', boxShadow:'0 4px 12px rgba(35,134,54,.3)' }}>
            + Nuevo Servidor
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'16px' }}>
            {[1,2].map(i => <div key={i} style={{ height:'240px', borderRadius:'12px', background:'linear-gradient(90deg,#161b22 25%,#1f2937 50%,#161b22 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : servers.length === 0 ? (
          <div style={{ background:'#1a1f2e', border:'1px solid #2d3748', borderRadius:'16px', padding:'4rem 2rem', textAlign:'center' }} className="fade-up">
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>⛏️</div>
            <h3 style={{ color:'#e6edf3', fontFamily:'monospace', margin:'0 0 .5rem' }}>Sin servidores aún</h3>
            <p style={{ color:'#6b7280', fontFamily:'monospace', fontSize:'13px', margin:'0 0 1.5rem' }}>Crea tu primer servidor Minecraft Vanilla</p>
            <button className="mc-btn" onClick={() => setShowCreate(true)} style={{ background:'#238636', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'14px', cursor:'pointer', fontFamily:'monospace' }}>
              + Crear primer servidor
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'16px' }}>
            {servers.map((s, i) => {
              const ex = extras[s.id];
              const stats = ex?.stats;
              const pl = ex?.players;
              const running = isRunning(s);
              const cpuPct = stats?.cpuPercent ?? 0;
              const memUsed = stats ? stats.memUsage / 1048576 : 0;
              const memTotal = stats ? stats.memLimit / 1048576 : 0;
              const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
              const cpuColor = cpuPct > 80 ? '#f87171' : cpuPct > 50 ? '#fbbf24' : '#34d399';
              const memColor = memPct > 85 ? '#f87171' : memPct > 60 ? '#fbbf24' : '#60a5fa';

              return (
                <div key={s.id} className="mc-card fade-up" style={{ background:'linear-gradient(145deg,#1a1f2e,#141820)', border:'1px solid #2d3748', borderRadius:'14px', padding:'20px', boxShadow:'0 4px 20px rgba(0,0,0,.35)', animationDelay:`${i*.06}s` }}>

                  {/* Top */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: running?'#34d399':'#f87171', boxShadow: running?'0 0 10px #34d399':'0 0 8px #f87171', animation: running?'pulse-dot 2s infinite':'none', flexShrink:0, marginTop:'2px' }} />
                      <div>
                        <div style={{ color:'#f3f4f6', fontWeight:700, fontFamily:'monospace', fontSize:'15px' }}>{s.nombre}</div>
                        <div style={{ color:'#374151', fontFamily:'monospace', fontSize:'11px', marginTop:'1px' }}>
                          {running && stats ? fmtUptime(stats.uptime) : 'offline'} · ID: {s.id}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      {running && pl && !pl.ready && (
                        <span style={{ color:'#fbbf24', fontSize:'11px', fontFamily:'monospace', background:'rgba(251,191,36,.1)', padding:'2px 8px', borderRadius:'20px', border:'1px solid rgba(251,191,36,.2)' }}>
                          iniciando...
                        </span>
                      )}
                      <span style={{ background: running?'rgba(52,211,153,.1)':'rgba(248,113,113,.1)', color: running?'#34d399':'#f87171', fontSize:'11px', padding:'3px 10px', borderRadius:'20px', fontWeight:600, fontFamily:'monospace', border: running?'1px solid rgba(52,211,153,.2)':'1px solid rgba(248,113,113,.2)' }}>
                        {running ? 'online' : 'offline'}
                      </span>
                    </div>
                  </div>

                  {/* Info chips */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                    {[
                      {l:'Versión', v:s.version,   c:'#60a5fa'},
                      {l:'RAM cfg',  v:s.memoria,   c:'#a78bfa'},
                      {l:'Puerto',   v:s.puerto?`:${s.puerto}`:'—', c:'#fbbf24'}
                    ].map(x => (
                      <div key={x.l} style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:'8px', padding:'8px 10px' }}>
                        <div style={{ color:'#374151', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em' }}>{x.l}</div>
                        <div style={{ color:x.c, fontSize:'13px', fontFamily:'monospace', fontWeight:600, marginTop:'3px' }}>{x.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Stats en vivo */}
                  {running && stats && (
                    <div style={{ marginBottom:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>

                      {/* CPU */}
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                          <span style={{ color:'#6b7280', fontSize:'11px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em' }}>CPU</span>
                          <span style={{ color:cpuColor, fontSize:'12px', fontFamily:'monospace', fontWeight:600 }}>{cpuPct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height:'5px', background:'rgba(255,255,255,.06)', borderRadius:'9999px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${cpuPct}%`, background:cpuColor, borderRadius:'9999px', transition:'width .5s ease', boxShadow:`0 0 8px ${cpuColor}55` }} />
                        </div>
                      </div>

                      {/* RAM real */}
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                          <span style={{ color:'#6b7280', fontSize:'11px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em' }}>RAM uso real</span>
                          <span style={{ color:memColor, fontSize:'12px', fontFamily:'monospace', fontWeight:600 }}>{fmt(stats.memUsage)} / {fmt(stats.memLimit)}</span>
                        </div>
                        <div style={{ height:'5px', background:'rgba(255,255,255,.06)', borderRadius:'9999px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(memPct,100)}%`, background:memColor, borderRadius:'9999px', transition:'width .5s ease', boxShadow:`0 0 8px ${memColor}55` }} />
                        </div>
                      </div>

                      {/* Network + Players */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:'8px', padding:'8px 10px' }}>
                          <div style={{ color:'#374151', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'4px' }}>Red total</div>
                          <div style={{ color:'#22d3ee', fontSize:'12px', fontFamily:'monospace' }}>↑ {fmt(stats.netOut)}</div>
                          <div style={{ color:'#818cf8', fontSize:'12px', fontFamily:'monospace' }}>↓ {fmt(stats.netIn)}</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:'8px', padding:'8px 10px' }}>
                          <div style={{ color:'#374151', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'4px' }}>
                            Jugadores {pl ? `${pl.players.length}/${pl.maxPlayers}` : '—'}
                          </div>
                          {pl && pl.players.length > 0 ? (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                              {pl.players.slice(0,5).map(p => (
                                <span key={p} style={{ background:'rgba(52,211,153,.15)', color:'#34d399', fontSize:'10px', fontFamily:'monospace', padding:'1px 6px', borderRadius:'4px', border:'1px solid rgba(52,211,153,.2)' }}>{p}</span>
                              ))}
                              {pl.players.length > 5 && <span style={{ color:'#6b7280', fontSize:'10px', fontFamily:'monospace' }}>+{pl.players.length-5}</span>}
                            </div>
                          ) : (
                            <div style={{ color:'#4b5563', fontSize:'12px', fontFamily:'monospace' }}>{pl?.ready ? 'Nadie online' : 'Cargando...'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botones */}
                  <div style={{ display:'flex', gap:'8px' }}>
                    {!running ? (
                      <button className="mc-btn" disabled={actionId===`${s.id}-start`} onClick={() => handleAction(s.id,'start')} style={{ flex:1, padding:'9px 0', background:'rgba(52,211,153,.1)', color:'#34d399', border:'1px solid rgba(52,211,153,.2)', borderRadius:'8px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                        {actionId===`${s.id}-start`?'⏳':'▶ Iniciar'}
                      </button>
                    ) : (
                      <>
                        <button className="mc-btn" disabled={actionId===`${s.id}-stop`} onClick={() => handleAction(s.id,'stop')} style={{ flex:1, padding:'9px 0', background:'rgba(248,113,113,.1)', color:'#f87171', border:'1px solid rgba(248,113,113,.2)', borderRadius:'8px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                          {actionId===`${s.id}-stop`?'⏳':'■ Detener'}
                        </button>
                        <button className="mc-btn" disabled={actionId===`${s.id}-restart`} onClick={() => handleAction(s.id,'restart')} style={{ flex:1, padding:'9px 0', background:'rgba(96,165,250,.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,.2)', borderRadius:'8px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
                          {actionId===`${s.id}-restart`?'⏳':'↺ Reiniciar'}
                        </button>
                      </>
                    )}
                    <button className="mc-btn" onClick={() => handleLogs(s.id)} title="Logs" style={{ padding:'9px 12px', background:'rgba(255,255,255,.05)', color:'#9ca3af', border:'1px solid rgba(255,255,255,.08)', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>📋</button>
                    <button className="mc-btn" disabled={!!actionId} onClick={() => handleAction(s.id,'delete')} title="Eliminar" style={{ padding:'9px 12px', background:'rgba(255,255,255,.03)', color:'#4b5563', border:'1px solid rgba(255,255,255,.06)', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL CREAR */}
        {showCreate && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setShowCreate(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 64px rgba(0,0,0,.7)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
                <h2 style={{ color:'#f9fafb', margin:0, fontFamily:'monospace', fontSize:'18px', fontWeight:700 }}>⛏️ Nuevo Servidor Vanilla</h2>
                <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
              </div>
              <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div>
                  <label style={lbl}>Nombre</label>
                  <input type="text" required placeholder="Mi-Servidor" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Versión</label>
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
                    <input type="number" required min="1024" max="65535" value={form.puerto} onChange={e => setForm(f=>({...f,puerto:e.target.value}))} style={inp} />
                  </div>
                </div>
                {error && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 12px', color:'#f85149', fontSize:'13px', fontFamily:'monospace' }}>⚠️ {error}</div>}
                <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ flex:1, padding:'10px', background:'#21262d', color:'#8b949e', border:'1px solid #30363d', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'monospace' }}>Cancelar</button>
                  <button type="submit" disabled={creating} className="mc-btn" style={{ flex:2, padding:'10px', background: creating?'#21262d':'#238636', color: creating?'#6b7280':'#fff', border:'none', borderRadius:'8px', cursor: creating?'not-allowed':'pointer', fontSize:'14px', fontWeight:700, fontFamily:'monospace' }}>
                    {creating ? '⏳ Creando...' : '🚀 Crear servidor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL LOGS */}
        {logs && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setLogs(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'12px', width:'100%', maxWidth:'860px', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #21262d' }}>
                <span style={{ color:'#34d399', fontFamily:'monospace', fontSize:'14px', fontWeight:600 }}>📋 Logs — {logs.id}</span>
                <button onClick={() => setLogs(null)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px' }}>×</button>
              </div>
              <pre style={{ margin:0, padding:'16px 20px', overflow:'auto', color:'#e6edf3', fontFamily:'monospace', fontSize:'12px', lineHeight:'1.6', flex:1 }}>
                {logs.content || 'Sin logs aún...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
}