import { useState, useEffect, useCallback, useRef } from 'react';
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
interface FileEntry {
  name: string; type: 'file' | 'dir';
  size: number; sizeStr: string;
  modified: string; path: string;
}

// ── Versiones agrupadas ────────────────────────────────────────
const MC_VERSIONS_GROUPED = [
  { label: '1.21.x — Tricky Trials',                versions: ['1.21.4','1.21.3','1.21.1','1.21'] },
  { label: '1.20.x — Trails & Tales',               versions: ['1.20.6','1.20.4','1.20.2','1.20.1','1.20'] },
  { label: '1.19.x — The Wild Update',              versions: ['1.19.4','1.19.3','1.19.2','1.19.1','1.19'] },
  { label: '1.18.x — Caves & Cliffs II',            versions: ['1.18.2','1.18.1','1.18'] },
  { label: '1.17.x — Caves & Cliffs I',             versions: ['1.17.1','1.17'] },
  { label: '1.16.x — Nether Update',                versions: ['1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16'] },
  { label: '1.15.x — Buzzy Bees',                   versions: ['1.15.2','1.15.1','1.15'] },
  { label: '1.14.x — Village & Pillage',            versions: ['1.14.4','1.14.3','1.14.2','1.14'] },
  { label: '1.13.x — Update Aquatic',               versions: ['1.13.2','1.13.1','1.13'] },
  { label: '1.12.x — World of Color',               versions: ['1.12.2','1.12.1','1.12'] },
  { label: '1.11.x — Exploration Update',           versions: ['1.11.2','1.11'] },
  { label: '1.10.x — Frostburn Update',             versions: ['1.10.2','1.10'] },
  { label: '1.9.x — Combat Update',                 versions: ['1.9.4','1.9.2','1.9'] },
  { label: '1.8.x — Bountiful Update',              versions: ['1.8.9','1.8.8','1.8.7','1.8'] },
  { label: '1.7.x — The Update that Changed the World', versions: ['1.7.10','1.7.5','1.7.2'] },
  { label: '1.6.x — Horse Update',                  versions: ['1.6.4','1.6.2','1.6.1'] },
  { label: '1.5.x — Redstone Update',               versions: ['1.5.2','1.5.1','1.5'] },
  { label: '1.4.x — Pretty Scary Update',           versions: ['1.4.7','1.4.6','1.4.2'] },
  { label: '1.3.x — Adventure Update II',           versions: ['1.3.2','1.3.1'] },
  { label: '1.2.x',                                 versions: ['1.2.5','1.2.4','1.2.3'] },
  { label: '1.1.x / 1.0 — Clásico',                versions: ['1.1','1.0'] },
];

const MC_MEMORY = ['512M','1G','2G','3G','4G','6G','8G'];

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
  .fm-row{transition:background .15s,transform .1s;cursor:pointer}
  .fm-row:hover{background:rgba(255,255,255,.05)!important;transform:translateX(3px)}
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

  // File Manager
  const [filesMgr,       setFilesMgr]       = useState<string|null>(null);
  const [fmPath,         setFmPath]         = useState('');
  const [fmFiles,        setFmFiles]        = useState<FileEntry[]>([]);
  const [fmLoading,      setFmLoading]      = useState(false);
  const [fmContent,      setFmContent]      = useState<{name:string;text:string}|null>(null);
  const [worldUploading, setWorldUploading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────
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

  // ── Acciones ──────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError('');
    try {
      await api.post('/minecraft/create', {
        nombre: form.nombre, version: form.version,
        memoria: form.memoria, puerto: Number(form.puerto)
      });
      setShowCreate(false);
      setForm({nombre:'',version:'1.20.4',memoria:'2G',puerto:'25565'});
      await fetchServers();
    } catch (err: any) { setError(err.response?.data?.error || 'Error al crear'); }
    finally { setCreating(false); }
  };

  const handleAction = async (id: string, action: 'start'|'stop'|'restart'|'delete') => {
    if (action === 'delete' && !confirm('¿Eliminar este servidor? No se puede deshacer.')) return;
    setActionId(`${id}-${action}`);
    try {
      action === 'delete'
        ? await api.delete(`/minecraft/${id}`)
        : await api.post(`/minecraft/${id}/${action}`);
      await fetchServers();
    } catch (err: any) { alert(err.response?.data?.error || `Error: ${action}`); }
    finally { setActionId(null); }
  };

  const handleLogs = async (id: string) => {
    try { const r = await api.get(`/minecraft/${id}/logs`); setLogs({ id, content: r.data.logs }); }
    catch { alert('Error al obtener logs'); }
  };

  // ── File Manager ──────────────────────────────────────────────
  const openFM = (id: string) => {
    setFilesMgr(id); setFmPath(''); setFmContent(null); loadFiles(id, '');
  };

  const loadFiles = async (id: string, p: string) => {
    setFmLoading(true);
    try {
      const r = await api.get(`/minecraft/${id}/files?path=${encodeURIComponent(p)}`);
      if (r.data.type === 'dir') { setFmFiles(r.data.files); setFmPath(p); setFmContent(null); }
      else setFmContent({ name: p.split('/').pop() || '', text: r.data.content });
    } catch {} finally { setFmLoading(false); }
  };

  const uploadWorld = async (id: string, file: File) => {
    setWorldUploading(true);
    try {
      const fd = new FormData(); fd.append('world', file);
      await api.post(`/minecraft/${id}/upload-world`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadFiles(id, fmPath);
      alert('✅ Mundo subido correctamente');
    } catch (e: any) { alert('❌ ' + (e.response?.data?.error || 'Error al subir')); }
    finally { setWorldUploading(false); }
  };

  const deleteFMEntry = async (id: string, p: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${p.split('/').pop()}"? No se puede deshacer.`)) return;
    try { await api.delete(`/minecraft/${id}/files?path=${encodeURIComponent(p)}`); loadFiles(id, fmPath); }
    catch {}
  };

  const fmGoBack = () => {
    const parts = fmPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.join('/');
    loadFiles(filesMgr!, newPath);
  };

  // ── Estilos reutilizables ─────────────────────────────────────
  const isRunning = (s: MCServer) => s.estado === 'running';
  const inp: React.CSSProperties = {
    width:'100%', padding:'10px 12px', background:'#0d1117',
    border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3',
    fontSize:'14px', fontFamily:'monospace', boxSizing:'border-box', transition:'border-color .15s'
  };
  const lbl: React.CSSProperties = {
    display:'block', color:'#8b949e', fontSize:'11px', fontFamily:'monospace',
    marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em'
  };

  // ── Render ────────────────────────────────────────────────────
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
              const cpuPct  = stats?.cpuPercent ?? 0;
              const memUsed = stats ? stats.memUsage / 1048576 : 0;
              const memTotal = stats ? stats.memLimit / 1048576 : 0;
              const memPct  = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
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
                      {l:'Versión', v:s.version,              c:'#60a5fa'},
                      {l:'RAM cfg', v:s.memoria,              c:'#a78bfa'},
                      {l:'Puerto',  v:s.puerto?`:${s.puerto}`:'—', c:'#fbbf24'}
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
                      {/* RAM */}
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                          <span style={{ color:'#6b7280', fontSize:'11px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.05em' }}>RAM uso real</span>
                          <span style={{ color:memColor, fontSize:'12px', fontFamily:'monospace', fontWeight:600 }}>{fmt(stats.memUsage)} / {fmt(stats.memLimit)}</span>
                        </div>
                        <div style={{ height:'5px', background:'rgba(255,255,255,.06)', borderRadius:'9999px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(memPct,100)}%`, background:memColor, borderRadius:'9999px', transition:'width .5s ease', boxShadow:`0 0 8px ${memColor}55` }} />
                        </div>
                      </div>
                      {/* Red + Players */}
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
                    {/* ── NUEVO: botón archivos ── */}
                    <button className="mc-btn" onClick={() => openFM(s.id)} title="Archivos del servidor" style={{ padding:'9px 12px', background:'rgba(167,139,250,.08)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.15)', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>📁</button>
                    <button className="mc-btn" disabled={!!actionId} onClick={() => handleAction(s.id,'delete')} title="Eliminar" style={{ padding:'9px 12px', background:'rgba(255,255,255,.03)', color:'#4b5563', border:'1px solid rgba(255,255,255,.06)', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ MODAL CREAR ════ */}
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
                    {MC_VERSIONS_GROUPED.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.versions.map(v => <option key={v} value={v}>{v}</option>)}
                      </optgroup>
                    ))}
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
                  <button type="submit" disabled={creating} className="mc-btn" style={{ flex:2, padding:'10px', background:creating?'#21262d':'#238636', color:creating?'#6b7280':'#fff', border:'none', borderRadius:'8px', cursor:creating?'not-allowed':'pointer', fontSize:'14px', fontWeight:700, fontFamily:'monospace' }}>
                    {creating ? '⏳ Creando...' : '🚀 Crear servidor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════ MODAL LOGS ════ */}
        {logs && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setLogs(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'12px', width:'100%', maxWidth:'860px', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #21262d' }}>
                <span style={{ color:'#34d399', fontFamily:'monospace', fontSize:'14px', fontWeight:600 }}>📋 Logs — {logs.id}</span>
                <button onClick={() => setLogs(null)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px' }}>×</button>
              </div>
              <pre style={{ margin:0, padding:'16px 20px', overflow:'auto', color:'#e6edf3', fontFamily:'monospace', fontSize:'12px', lineHeight:'1.6', flex:1 }}>
                {logs.content || 'Sin logs aún...'}
                <div ref={logsEndRef} />
              </pre>
            </div>
          </div>
        )}

        {/* ════ MODAL FILE MANAGER ════ */}
        {filesMgr && (
          <div className="overlay" onClick={e => e.target===e.currentTarget&&setFilesMgr(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
            <div className="modal" style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:'14px', width:'100%', maxWidth:'740px', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.8)' }}>

              {/* Header FM */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'16px 20px', borderBottom:'1px solid #21262d', flexWrap:'wrap', rowGap:'8px' }}>
                <span style={{ fontSize:'18px' }}>📁</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'monospace', fontSize:'12px', color:'#8b949e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    <span style={{ color:'#e6edf3', fontWeight:600 }}>/{filesMgr}</span>
                    {fmPath && <span style={{ color:'#60a5fa' }}>/{fmPath}</span>}
                  </div>
                </div>
                {/* Subir mundo ZIP */}
                <label style={{ background:'rgba(167,139,250,.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.2)', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' }}>
                  {worldUploading ? '⏳ Subiendo...' : '⬆ Subir mundo (.zip)'}
                  <input type="file" accept=".zip" style={{ display:'none' }} disabled={worldUploading}
                    onChange={e => e.target.files?.[0] && uploadWorld(filesMgr, e.target.files[0])} />
                </label>
                {/* Descargar mundo */}
                <button onClick={() => window.open(`/api/minecraft/${filesMgr}/download-world`, '_blank')}
                  style={{ background:'rgba(96,165,250,.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,.2)', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' }}>
                  ⬇ Descargar mundo
                </button>
                <button onClick={() => setFilesMgr(null)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1, marginLeft:'4px' }}>×</button>
              </div>

              {/* Breadcrumb + back */}
              {(fmPath || fmContent) && (
                <div style={{ padding:'8px 16px 0' }}>
                  <button onClick={() => { if (fmContent) { setFmContent(null); } else fmGoBack(); }}
                    style={{ background:'rgba(255,255,255,.04)', border:'1px solid #21262d', borderRadius:'8px', color:'#8b949e', padding:'5px 12px', fontSize:'12px', cursor:'pointer', fontFamily:'monospace' }}>
                    ← Volver
                  </button>
                </div>
              )}

              {/* Contenido */}
              <div style={{ flex:1, overflow:'auto', padding:'12px 16px' }}>
                {fmLoading ? (
                  <div style={{ color:'#8b949e', fontFamily:'monospace', fontSize:'13px', textAlign:'center', padding:'40px' }}>
                    <div style={{ width:'20px', height:'20px', border:'2px solid #374151', borderTopColor:'#60a5fa', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' }} />
                    Cargando...
                  </div>
                ) : fmContent ? (
                  /* Vista de archivo */
                  <div>
                    <div style={{ color:'#8b949e', fontSize:'12px', fontFamily:'monospace', marginBottom:'8px' }}>
                      📄 {fmContent.name}
                    </div>
                    <pre style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'16px', color:'#e6edf3', fontSize:'12px', fontFamily:'monospace', overflowX:'auto', whiteSpace:'pre-wrap', lineHeight:'1.6', maxHeight:'500px', overflow:'auto' }}>
                      {fmContent.text || '(archivo vacío)'}
                    </pre>
                  </div>
                ) : fmFiles.length === 0 ? (
                  <div style={{ color:'#8b949e', fontFamily:'monospace', fontSize:'13px', textAlign:'center', padding:'40px' }}>
                    Carpeta vacía
                  </div>
                ) : (
                  /* Lista de archivos */
                  <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                    {fmFiles.map(f => (
                      <div key={f.path} className="fm-row"
                        onClick={() => loadFiles(filesMgr!, f.path)}
                        style={{ display:'flex', alignItems:'center', gap:'12px', padding:'9px 12px', borderRadius:'8px', background:'rgba(255,255,255,.02)', border:'1px solid transparent' }}>
                        <span style={{ fontSize:'16px', flexShrink:0 }}>{f.type === 'dir' ? '📂' : '📄'}</span>
                        <span style={{ flex:1, fontFamily:'monospace', fontSize:'13px', color: f.type==='dir' ? '#60a5fa' : '#e6edf3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {f.name}
                        </span>
                        {f.type === 'file' && (
                          <span style={{ color:'#4b5563', fontSize:'11px', fontFamily:'monospace', flexShrink:0 }}>{f.sizeStr}</span>
                        )}
                        <button onClick={e => deleteFMEntry(filesMgr!, f.path, e)}
                          style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', fontSize:'14px', padding:'2px 6px', borderRadius:'4px', transition:'color .15s', flexShrink:0 }}
                          onMouseEnter={e => (e.currentTarget.style.color='#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color='#374151')}>
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}