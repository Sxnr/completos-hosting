import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
interface FileEntry { name: string; type: 'file' | 'dir'; size?: number; modified?: string; path: string; }
type Tab = 'servidor' | 'consola' | 'archivos' | 'jugadores' | 'opciones' | 'mundos';

const css = `
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
@keyframes spin{to{transform:rotate(360deg)}}
.srv-nav-item{transition:all .15s;cursor:pointer;border-radius:8px;}
.srv-nav-item:hover{background:rgba(255,255,255,.06);}
.srv-nav-item.active{background:rgba(88,166,255,.12);color:#58a6ff!important;}
.srv-btn{transition:all .15s;cursor:pointer;}
.srv-btn:hover:not(:disabled){transform:translateY(-1px);}
.srv-btn:active:not(:disabled){transform:translateY(0);}
.prop-row{transition:background .15s;}
.prop-row:hover{background:rgba(255,255,255,.03);}
.file-row{transition:background .15s;cursor:pointer;}
.file-row:hover{background:rgba(255,255,255,.05);}
input:focus,select:focus,textarea:focus{border-color:#58a6ff!important;outline:none;}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:#0d1117}
::-webkit-scrollbar-thumb{background:#21262d;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#30363d}
`;

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b/1048576).toFixed(1)} MB`;
  return `${(b/1073741824).toFixed(2)} GB`;
}
function fmtUptime(ms: number) {
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);
  if(d>0) return `${d}d ${h%24}h`;
  if(h>0) return `${h}h ${m%60}m`;
  if(m>0) return `${m}m ${s%60}s`;
  return `${s}s`;
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    // Fallback para HTTP
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width:44, height:24, borderRadius:12, cursor:'pointer',
      background: value ? '#238636' : '#21262d',
      border:`1px solid ${value ? '#2ea043' : '#30363d'}`,
      position:'relative', display:'flex', alignItems:'center', padding:'0 3px',
      boxSizing:'border-box', transition:'all .2s',
      boxShadow: value ? '0 0 8px rgba(35,134,54,.4)' : 'none',
    }}>
      <div style={{
        width:16, height:16, borderRadius:'50%',
        background: value ? '#3fb950' : '#484f58',
        transform: value ? 'translateX(20px)' : 'translateX(0)',
        transition:'all .2s',
      }}/>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }: {
  icon:string; label:string; active:boolean; onClick:()=>void; badge?:number;
}) {
  return (
    <div className={`srv-nav-item${active?' active':''}`} onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      color: active ? '#58a6ff' : '#8b949e', fontSize:14, fontFamily:'monospace', marginBottom:2,
    }}>
      <span style={{fontSize:16, minWidth:20, textAlign:'center'}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{background:'#238636',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600}}>{badge}</span>
      )}
    </div>
  );
}

const PROP_FIELDS = [
  {key:'white-list',        label:'Lista blanca',              type:'bool'},
  {key:'online-mode',       label:'Modo online (anti-crack)',  type:'bool'},
  {key:'allow-flight',      label:'Volar',                     type:'bool'},
  {key:'force-gamemode',    label:'Forzar modo de juego',      type:'bool'},
  {key:'pvp',               label:'PvP',                       type:'bool'},
  {key:'enable-command-block',label:'Bloques de comandos',     type:'bool'},
  {key:'require-resource-pack',label:'Paquete de recursos requerido', type:'bool'},
  {key:'max-players',       label:'Espacios',                  type:'number'},
  {key:'spawn-protection',  label:'Protección de spawn',       type:'number'},
  {key:'view-distance',     label:'Distancia de vista',        type:'number'},
  {key:'gamemode',          label:'Modo de juego',             type:'select', options:['survival','creative','adventure','spectator']},
  {key:'difficulty',        label:'Dificultad',                type:'select', options:['peaceful','easy','normal','hard']},
  {key:'motd',              label:'MOTD (descripción)',        type:'text'},
  {key:'resource-pack',     label:'Paquete de recursos (URL)', type:'text'},
  {key:'resource-pack-prompt',label:'Mensaje del paquete',    type:'text'},
];

export default function MinecraftServer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer]   = useState<MCServer|null>(null);
  const [stats, setStats]     = useState<MCStats|null>(null);
  const [players, setPlayers] = useState<MCPlayers|null>(null);
  const [tab, setTab]         = useState<Tab>('servidor');
  const [logs, setLogs]       = useState('');
  const [cmd, setCmd]         = useState('');
  const [files, setFiles]     = useState<FileEntry[]>([]);
  const [filePath, setFilePath] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [action, setAction]   = useState('');
  const [props, setProps]     = useState<Record<string,string>>({});
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);
  const logTimer = useRef<any>(null);

  const inp: React.CSSProperties = {
    width:'100%', padding:'8px 12px', background:'#0d1117',
    border:'1px solid #30363d', borderRadius:8, color:'#e6edf3',
    fontSize:13, fontFamily:'monospace', boxSizing:'border-box', transition:'border-color .15s',
  };

  const fetchServer = useCallback(async () => {
    try {
      const r = await api.get('/minecraft');
      const s = r.data.find((x:MCServer) => x.id === id);
      if (s) { setServer(s); if (!nameVal) setNameVal(s.nombre); }
    } catch {}
  }, [id]);

  const fetchStats   = useCallback(async () => { try { const r = await api.get(`/minecraft/${id}/stats`);   setStats(r.data);   } catch {} }, [id]);
  const fetchPlayers = useCallback(async () => { try { const r = await api.get(`/minecraft/${id}/players`); setPlayers(r.data); } catch {} }, [id]);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await api.get(`/minecraft/${id}/logs`);
      setLogs(r.data.logs || '');
      setTimeout(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, 50);
    } catch {}
  }, [id]);

  const fetchFiles = useCallback(async (path='') => {
    setLoadingFiles(true);
    try {
      const r = await api.get(`/minecraft/${id}/files`, { params: { path } });
      setFiles(r.data.files ?? r.data);
      setFilePath(path);
    } catch {} finally { setLoadingFiles(false); }
  }, [id]);

  const fetchProps = useCallback(async () => {
    try {
      const r = await api.get(`/minecraft/${id}/files`, { params: { path:'server.properties' } });
      const text: string = r.data.content || '';
      const parsed: Record<string,string> = {};
      text.split('\n').forEach(line => {
        if (line.startsWith('#') || !line.includes('=')) return;
        const [k,...v] = line.split('=');
        parsed[k.trim()] = v.join('=').trim();
      });
      setProps(parsed);
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchServer(); fetchStats(); fetchPlayers();
    const t = setInterval(() => { fetchServer(); fetchStats(); fetchPlayers(); }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    clearInterval(logTimer.current);
    if (tab === 'consola')  { fetchLogs();  logTimer.current = setInterval(fetchLogs, 3000); }
    if (tab === 'archivos') fetchFiles('');
    if (tab === 'opciones') fetchProps();
    return () => clearInterval(logTimer.current);
  }, [tab]);

  const doAction = async (a: 'start'|'stop'|'restart') => {
    setAction(a);
    try { await api.post(`/minecraft/${id}/${a}`); setTimeout(fetchStats, 2000); }
    catch (e:any) { alert(e.response?.data?.error || `Error: ${a}`); }
    finally { setAction(''); }
  };

  const sendCmd = async () => {
    if (!cmd.trim()) return;
    try { await api.post(`/minecraft/${id}/command`, { command: cmd }); setCmd(''); setTimeout(fetchLogs, 800); }
    catch {}
  };

  const isRunning  = server?.estado === 'running';
  const isStarting = server?.estado === 'starting';
  const serverIP   = server ? `${server.nombre.toLowerCase().replace(/\s+/g,'-')}.completos.host:${server.puerto||25565}` : '';

  if (!server) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'70vh',color:'#8b949e',fontFamily:'monospace',flexDirection:'column',gap:12}}>
      <div style={{fontSize:32}}>⏳</div>Cargando servidor...
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div style={{display:'flex', height:'calc(100vh - 60px)', overflow:'hidden', background:'#0d1117'}}>

        {/* ══ SIDEBAR ══ */}
        <div style={{width:220, minWidth:220, background:'#161b22', borderRight:'1px solid #21262d', display:'flex', flexDirection:'column'}}>

          {/* Server identity */}
          <div style={{padding:'16px 14px', borderBottom:'1px solid #21262d'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
              <div style={{width:38,height:38,borderRadius:9,background:'linear-gradient(135deg,#238636,#2ea043)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                ⛏️
              </div>
              <div style={{minWidth:0, flex:1}}>
                {editName ? (
                  <input value={nameVal} onChange={e=>setNameVal(e.target.value)}
                    onBlur={()=>setEditName(false)}
                    onKeyDown={e=>e.key==='Enter'&&setEditName(false)}
                    autoFocus style={{...inp,padding:'3px 6px',fontSize:13,width:'100%'}}/>
                ) : (
                  <div onClick={()=>setEditName(true)} title="Click para editar" style={{
                    color:'#e6edf3',fontSize:13,fontWeight:600,fontFamily:'monospace',
                    cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
                  }}>{server.nombre} <span style={{color:'#484f58',fontSize:11}}>✏️</span></div>
                )}
                <div style={{display:'flex',alignItems:'center',gap:5,marginTop:3}}>
                  <div style={{width:6,height:6,borderRadius:'50%',
                    background: isRunning?'#34d399':isStarting?'#fbbf24':'#f87171',
                    animation: isRunning||isStarting?'pulse-dot 2s infinite':'none'}}/>
                  <span style={{color:isRunning?'#34d399':isStarting?'#fbbf24':'#f87171',fontSize:11,fontFamily:'monospace'}}>
                    {isRunning?'Online':isStarting?'Iniciando...':'Offline'}
                  </span>
                </div>
              </div>
            </div>
            {/* IP chip */}
            <div onClick={()=>copyText(serverIP)} title="Click para copiar" style={{
              background:'#0d1117',border:'1px solid #21262d',borderRadius:6,
              padding:'5px 8px',fontSize:10,color:'#6b7280',fontFamily:'monospace',
              cursor:'pointer',wordBreak:'break-all',
            }}>
              📋 {serverIP}
            </div>
          </div>

          {/* Nav */}
          <nav style={{flex:1,padding:'10px 8px',overflowY:'auto'}}>
            <NavItem icon="🖥️" label="Servidor"  active={tab==='servidor'}  onClick={()=>setTab('servidor')}/>
            <NavItem icon="▶" label="Consola"    active={tab==='consola'}   onClick={()=>setTab('consola')}/>
            <NavItem icon="📁" label="Archivos"  active={tab==='archivos'}  onClick={()=>setTab('archivos')}/>
            <NavItem icon="👥" label="Jugadores" active={tab==='jugadores'} onClick={()=>setTab('jugadores')} badge={players?.players.length}/>
            <NavItem icon="⚙️" label="Opciones"  active={tab==='opciones'}  onClick={()=>setTab('opciones')}/>
            <NavItem icon="🌍" label="Mundos"    active={tab==='mundos'}    onClick={()=>setTab('mundos')}/>
          </nav>

          {/* Back */}
          <div style={{padding:'10px 8px',borderTop:'1px solid #21262d'}}>
            <div className="srv-nav-item" onClick={()=>navigate('/minecraft')} style={{
              display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
              color:'#6b7280',fontSize:13,fontFamily:'monospace'
            }}>← Mis servidores</div>
          </div>
        </div>

        {/* ══ MAIN ══ */}
        <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>

          {/* Status bar */}
          <div style={{
            background: isRunning?'rgba(52,211,153,.07)':isStarting?'rgba(251,191,36,.07)':'rgba(248,113,113,.07)',
            borderBottom:`1px solid ${isRunning?'rgba(52,211,153,.2)':isStarting?'rgba(251,191,36,.2)':'rgba(248,113,113,.2)'}`,
            padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:8,height:8,borderRadius:'50%',
                background:isRunning?'#34d399':isStarting?'#fbbf24':'#f87171',
                animation:isRunning||isStarting?'pulse-dot 2s infinite':'none'}}/>
              <span style={{color:isRunning?'#34d399':isStarting?'#fbbf24':'#f87171',fontFamily:'monospace',fontWeight:700,fontSize:15}}>
                {isRunning?'● Conectado':isStarting?'◔ Iniciando...':'○ Desconectado'}
              </span>
              {isRunning&&stats&&<span style={{color:'#6b7280',fontSize:12,fontFamily:'monospace'}}>· {fmtUptime(stats.uptime)}</span>}
            </div>

            <div style={{display:'flex',gap:8}}>
              {!isRunning&&!isStarting&&(
                <button className="srv-btn" onClick={()=>doAction('start')} disabled={!!action} style={{
                  background:'linear-gradient(135deg,#238636,#2ea043)',color:'#fff',border:'none',
                  borderRadius:8,padding:'8px 22px',fontSize:13,fontWeight:700,fontFamily:'monospace',
                  cursor:'pointer',boxShadow:'0 4px 12px rgba(35,134,54,.4)',display:'flex',alignItems:'center',gap:6
                }}>
                  {action==='start'?'⏳':'⏻'} Iniciar
                </button>
              )}
              {(isRunning||isStarting)&&<>
                <button className="srv-btn" onClick={()=>doAction('restart')} disabled={!!action} style={{
                  background:'rgba(96,165,250,.1)',color:'#60a5fa',border:'1px solid rgba(96,165,250,.25)',
                  borderRadius:8,padding:'7px 16px',fontSize:13,fontFamily:'monospace',cursor:'pointer'
                }}>{action==='restart'?'⏳':'↺ Reiniciar'}</button>
                <button className="srv-btn" onClick={()=>doAction('stop')} disabled={!!action} style={{
                  background:'rgba(248,113,113,.1)',color:'#f87171',border:'1px solid rgba(248,113,113,.25)',
                  borderRadius:8,padding:'7px 16px',fontSize:13,fontFamily:'monospace',cursor:'pointer'
                }}>{action==='stop'?'⏳':'■ Detener'}</button>
              </>}
            </div>
          </div>

          {/* Tab content */}
          <div style={{flex:1, overflowY:'auto', padding:24}}>

            {/* ─ SERVIDOR ─ */}
            {tab==='servidor'&&(
              <div style={{animation:'fadeUp .3s ease', maxWidth:860}}>
                {/* Info cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginBottom:20}}>
                  {[
                    {l:'Dirección',v:serverIP.split(':')[0],icon:'🔌',c:'#60a5fa',copy:true},
                    {l:'Puerto',   v:`:${server.puerto||25565}`,icon:'🔢',c:'#a78bfa'},
                    {l:'Versión',  v:server.version,           icon:'📦',c:'#34d399'},
                    {l:'RAM',      v:server.memoria,           icon:'💾',c:'#fbbf24'},
                  ].map(card=>(
                    <div key={card.l} onClick={card.copy?()=>copyText(serverIP):undefined} style={{
                      background:'linear-gradient(135deg,#161b22,#1e2535)',border:'1px solid #21262d',
                      borderRadius:12,padding:16,cursor:card.copy?'pointer':'default',
                    }}>
                      <div style={{color:'#6b7280',fontSize:11,fontFamily:'monospace',marginBottom:6,textTransform:'uppercase'}}>{card.icon} {card.l}</div>
                      <div style={{color:card.c,fontSize:15,fontFamily:'monospace',fontWeight:700}}>{card.v}</div>
                      {card.copy&&<div style={{color:'#484f58',fontSize:10,marginTop:4}}>Click para copiar</div>}
                    </div>
                  ))}
                </div>

                {/* Live stats */}
                {isRunning&&stats&&(
                  <div style={{background:'linear-gradient(135deg,#161b22,#1e2535)',border:'1px solid #21262d',borderRadius:14,padding:20,marginBottom:16}}>
                    <div style={{color:'#6b7280',fontSize:11,fontFamily:'monospace',marginBottom:14,textTransform:'uppercase',letterSpacing:'.05em'}}>📊 Rendimiento en vivo</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
                      {[
                        {l:'CPU',  val:`${stats.cpuPercent.toFixed(1)}%`,  pct:stats.cpuPercent, c:stats.cpuPercent>80?'#f87171':'#34d399'},
                        {l:'RAM',  val:`${fmt(stats.memUsage)}/${fmt(stats.memLimit)}`, pct:stats.memUsage/stats.memLimit*100, c:'#a78bfa'},
                      ].map(st=>(
                        <div key={st.l}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                            <span style={{color:'#8b949e',fontSize:12,fontFamily:'monospace'}}>{st.l}</span>
                            <span style={{color:st.c,fontSize:12,fontFamily:'monospace',fontWeight:700}}>{st.val}</span>
                          </div>
                          <div style={{background:'#0d1117',borderRadius:99,height:5,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(st.pct,100)}%`,background:st.c,borderRadius:99,transition:'width .5s'}}/>
                          </div>
                        </div>
                      ))}
                      <div>
                        <div style={{color:'#8b949e',fontSize:12,fontFamily:'monospace',marginBottom:6}}>Red</div>
                        <div style={{color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>↑ {fmt(stats.netOut)}<br/>↓ {fmt(stats.netIn)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Players */}
                {isRunning&&players&&(
                  <div style={{background:'linear-gradient(135deg,#161b22,#1e2535)',border:'1px solid #21262d',borderRadius:14,padding:20}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                      <span style={{color:'#9ca3af',fontSize:12,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'.05em'}}>👥 Jugadores</span>
                      <span style={{color:'#34d399',fontSize:13,fontFamily:'monospace',fontWeight:700}}>{players.players.length}/{players.maxPlayers}</span>
                    </div>
                    {players.players.length===0
                      ? <div style={{color:'#484f58',fontSize:13,fontFamily:'monospace'}}>Nadie conectado</div>
                      : <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                          {players.players.map(p=>(
                            <div key={p} style={{background:'#0d1117',border:'1px solid #21262d',borderRadius:6,padding:'5px 10px',color:'#e6edf3',fontSize:13,fontFamily:'monospace'}}>
                              🎮 {p}
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                )}
              </div>
            )}

            {/* ─ CONSOLA ─ */}
            {tab==='consola'&&(
              <div style={{animation:'fadeUp .3s ease',height:'calc(100vh - 200px)',display:'flex',flexDirection:'column'}}>
                <div ref={logsRef} style={{
                  flex:1,background:'#0d1117',border:'1px solid #21262d',borderRadius:10,
                  padding:16,overflowY:'auto',fontFamily:'monospace',fontSize:12,
                  color:'#34d399',lineHeight:1.7,marginBottom:12,whiteSpace:'pre-wrap',wordBreak:'break-all',
                }}>
                  {logs||<span style={{color:'#484f58'}}>Esperando logs...</span>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{color:'#34d399',fontFamily:'monospace',fontSize:16}}>{'>'}</span>
                  <input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendCmd()}
                    placeholder="Ejecutar comando en el servidor..." style={{...inp,flex:1}}/>
                  <button className="srv-btn" onClick={sendCmd} style={{
                    background:'#21262d',color:'#e6edf3',border:'1px solid #30363d',
                    borderRadius:8,padding:'8px 16px',fontFamily:'monospace',fontSize:13,cursor:'pointer',whiteSpace:'nowrap'
                  }}>Enviar ↵</button>
                </div>
              </div>
            )}

            {/* ─ ARCHIVOS ─ */}
            {tab==='archivos'&&(
              <div style={{animation:'fadeUp .3s ease'}}>
                {/* Breadcrumb */}
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:16,fontFamily:'monospace',fontSize:13}}>
                  <span style={{color:'#58a6ff',cursor:'pointer'}} onClick={()=>fetchFiles('')}>📁 raíz</span>
                  {filePath.split('/').filter(Boolean).map((seg,i,arr)=>(
                    <span key={i} style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{color:'#484f58'}}>/</span>
                      <span style={{color:i===arr.length-1?'#e6edf3':'#58a6ff',cursor:'pointer'}}
                        onClick={()=>fetchFiles(arr.slice(0,i+1).join('/'))}>{seg}</span>
                    </span>
                  ))}
                </div>

                {/* Back button */}
                {filePath&&(
                  <button className="srv-btn" onClick={()=>fetchFiles(filePath.includes('/')?filePath.split('/').slice(0,-1).join(''):'')}
                    style={{marginBottom:10,background:'#21262d',color:'#8b949e',border:'1px solid #30363d',borderRadius:6,padding:'5px 12px',fontSize:12,fontFamily:'monospace',cursor:'pointer'}}>
                    ← Subir nivel
                  </button>
                )}

                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:12,overflow:'hidden'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 100px 140px 80px',padding:'10px 16px',borderBottom:'1px solid #21262d',color:'#484f58',fontSize:11,fontFamily:'monospace',textTransform:'uppercase'}}>
                    <span>Nombre</span><span>Tamaño</span><span>Modificado</span><span></span>
                  </div>
                  {loadingFiles
                    ? <div style={{padding:32,textAlign:'center',color:'#484f58',fontFamily:'monospace'}}>Cargando...</div>
                    : files.length===0
                      ? <div style={{padding:32,textAlign:'center',color:'#484f58',fontFamily:'monospace'}}>Carpeta vacía</div>
                      : files.map((f,i)=>(
                          <div key={i} className="file-row"
                            onClick={()=>f.type==='dir'&&fetchFiles(f.path||(filePath?`${filePath}/${f.name}`:f.name))}
                            style={{display:'grid',gridTemplateColumns:'1fr 100px 140px 80px',padding:'10px 16px',borderBottom:'1px solid #0d1117',fontFamily:'monospace',fontSize:13}}>
                            <span style={{display:'flex',alignItems:'center',gap:8,overflow:'hidden'}}>
                              {f.type==='dir'?'📁':'📄'}
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:f.type==='dir'?'#58a6ff':'#e6edf3'}}>{f.name}</span>
                            </span>
                            <span style={{color:'#6b7280'}}>{f.size?fmt(f.size):'—'}</span>
                            <span style={{color:'#6b7280'}}>{f.modified?new Date(f.modified).toLocaleDateString('es-CL'):'—'}</span>
                            <span>
                              {f.type==='file'&&(
                                <button onClick={e=>{e.stopPropagation();api.delete(`/minecraft/${id}/files`,{params:{path:f.path}}).then(()=>fetchFiles(filePath))}}
                                  style={{background:'rgba(248,113,113,.1)',color:'#f87171',border:'none',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',fontFamily:'monospace'}}>
                                  🗑
                                </button>
                              )}
                            </span>
                          </div>
                        ))
                  }
                </div>
              </div>
            )}

            {/* ─ JUGADORES ─ */}
            {tab==='jugadores'&&(
              <div style={{animation:'fadeUp .3s ease',maxWidth:680}}>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:12,overflow:'hidden'}}>
                  <div style={{padding:'16px 20px',borderBottom:'1px solid #21262d',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:'#e6edf3',fontFamily:'monospace',fontWeight:600}}>👥 Jugadores online</span>
                    <span style={{color:'#34d399',fontFamily:'monospace',fontSize:13,fontWeight:700}}>{players?.players.length??0} / {players?.maxPlayers??'—'}</span>
                  </div>
                  {!players||players.players.length===0
                    ? <div style={{padding:40,textAlign:'center',color:'#484f58',fontFamily:'monospace'}}>{isRunning?'Nadie conectado':'Servidor offline'}</div>
                    : players.players.map((p,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #0d1117',fontFamily:'monospace'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:'#34d399'}}/>
                            <span style={{color:'#e6edf3',fontSize:14}}>{p}</span>
                          </div>
                          <div style={{display:'flex',gap:8}}>
                            {[
                              {l:'Kick',cmd:`kick ${p}`,c:'#fbbf24',bg:'rgba(251,191,36,.1)',bc:'rgba(251,191,36,.2)'},
                              {l:'Ban', cmd:`ban ${p}`, c:'#f87171',bg:'rgba(248,113,113,.1)',bc:'rgba(248,113,113,.2)'},
                              {l:'OP',  cmd:`op ${p}`,  c:'#60a5fa',bg:'rgba(96,165,250,.1)', bc:'rgba(96,165,250,.2)'},
                            ].map(btn=>(
                              <button key={btn.l} className="srv-btn"
                                onClick={()=>api.post(`/minecraft/${id}/command`,{command:btn.cmd})}
                                style={{background:btn.bg,color:btn.c,border:`1px solid ${btn.bc}`,borderRadius:6,padding:'4px 12px',fontSize:11,cursor:'pointer',fontFamily:'monospace',fontWeight:600}}>
                                {btn.l}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}

            {/* ─ OPCIONES (server.properties) ─ */}
            {tab==='opciones'&&(
              <div style={{animation:'fadeUp .3s ease',maxWidth:860}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
                  <span style={{fontSize:22}}>⚙️</span>
                  <span style={{color:'#e6edf3',fontFamily:'monospace',fontWeight:600,fontSize:16}}>server.properties</span>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {PROP_FIELDS.map(field=>(
                    <div key={field.key} className="prop-row" style={{
                      background:'#161b22',border:'1px solid #21262d',borderRadius:10,
                      padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,
                    }}>
                      <div>
                        <div style={{color:'#e6edf3',fontFamily:'monospace',fontSize:14,marginBottom:2}}>{field.label}</div>
                        <div style={{color:'#484f58',fontFamily:'monospace',fontSize:10}}>{field.key}={props[field.key]??'—'}</div>
                      </div>
                      <div style={{flexShrink:0}}>
                        {field.type==='bool'&&(
                          <Toggle value={(props[field.key]??'false')==='true'} onChange={v=>setProps(p=>({...p,[field.key]:v?'true':'false'}))}/>
                        )}
                        {field.type==='number'&&(
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <button onClick={()=>setProps(p=>({...p,[field.key]:String(Math.max(0,Number(p[field.key]??0)-1))}))}
                              style={{width:28,height:28,background:'#21262d',border:'1px solid #30363d',borderRadius:6,color:'#e6edf3',cursor:'pointer',fontSize:16,lineHeight:1}}>−</button>
                            <input type="number" value={props[field.key]??'0'} onChange={e=>setProps(p=>({...p,[field.key]:e.target.value}))}
                              style={{...inp,width:70,textAlign:'center',padding:'5px 8px'}}/>
                            <button onClick={()=>setProps(p=>({...p,[field.key]:String(Number(p[field.key]??0)+1)}))}
                              style={{width:28,height:28,background:'#21262d',border:'1px solid #30363d',borderRadius:6,color:'#e6edf3',cursor:'pointer',fontSize:16,lineHeight:1}}>+</button>
                          </div>
                        )}
                        {field.type==='select'&&(
                          <select value={props[field.key]??field.options![0]} onChange={e=>setProps(p=>({...p,[field.key]:e.target.value}))}
                            style={{...inp,width:170,cursor:'pointer'}}>
                            {field.options!.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                          </select>
                        )}
                        {field.type==='text'&&(
                          <input value={props[field.key]??''} onChange={e=>setProps(p=>({...p,[field.key]:e.target.value}))}
                            placeholder="—" style={{...inp,width:260}}/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="srv-btn" style={{
                  marginTop:18,background:'linear-gradient(135deg,#238636,#2ea043)',color:'#fff',
                  border:'none',borderRadius:8,padding:'10px 26px',fontSize:14,fontFamily:'monospace',
                  fontWeight:600,cursor:'pointer',boxShadow:'0 4px 12px rgba(35,134,54,.3)',
                }}>
                  💾 Guardar cambios
                </button>
              </div>
            )}

            {/* ─ MUNDOS ─ */}
            {tab==='mundos'&&(
              <div style={{animation:'fadeUp .3s ease',maxWidth:640}}>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:12,padding:24}}>
                  <div style={{color:'#e6edf3',fontFamily:'monospace',fontWeight:600,fontSize:15,marginBottom:20}}>🌍 Gestión de mundos</div>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>

                    {/* Descargar */}
                    <div style={{background:'#0d1117',border:'1px solid #21262d',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <div style={{color:'#e6edf3',fontFamily:'monospace',fontSize:14}}>📥 Descargar mundo</div>
                        <div style={{color:'#6b7280',fontSize:12,fontFamily:'monospace',marginTop:3}}>Exportar world/ como .zip</div>
                      </div>
                      <button className="srv-btn" onClick={async()=>{
                        try {
                          const r = await api.get(`/minecraft/${id}/download-world`,{responseType:'blob'});
                          const url = URL.createObjectURL(r.data);
                          const a = document.createElement('a');
                          a.href=url; a.download=`${server.nombre}-world.zip`; a.click();
                        } catch { alert('Error al descargar'); }
                      }} style={{background:'rgba(96,165,250,.1)',color:'#60a5fa',border:'1px solid rgba(96,165,250,.25)',borderRadius:8,padding:'8px 16px',fontSize:13,fontFamily:'monospace',cursor:'pointer'}}>
                        Descargar .zip
                      </button>
                    </div>

                    {/* Subir */}
                    <div style={{background:'#0d1117',border:'1px solid #21262d',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <div style={{color:'#e6edf3',fontFamily:'monospace',fontSize:14}}>📤 Subir mundo</div>
                        <div style={{color:'#6b7280',fontSize:12,fontFamily:'monospace',marginTop:3}}>Importar .zip para reemplazar world/</div>
                      </div>
                      <label style={{background:'rgba(167,139,250,.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,.25)',borderRadius:8,padding:'8px 16px',fontSize:13,fontFamily:'monospace',cursor:'pointer'}}>
                        Seleccionar .zip
                        <input type="file" accept=".zip" style={{display:'none'}} onChange={async e=>{
                          const file=e.target.files?.[0]; if(!file) return;
                          const fd=new FormData(); fd.append('world',file);
                          try { await api.post(`/minecraft/${id}/upload-world`,fd); alert('✅ Mundo subido'); }
                          catch { alert('Error al subir'); }
                        }}/>
                      </label>
                    </div>

                    <div style={{background:'rgba(251,191,36,.05)',border:'1px solid rgba(251,191,36,.15)',borderRadius:10,padding:'10px 14px',color:'#fbbf24',fontSize:12,fontFamily:'monospace'}}>
                      ⚠️ Detén el servidor antes de subir un mundo para evitar corrupción.
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}   