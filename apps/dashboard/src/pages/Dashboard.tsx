import { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

const styles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(1.4); }
  }
  @keyframes pulse-online {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
    50%       { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes barFill {
    from { width: 0%; }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    50%       { box-shadow: 0 4px 32px rgba(96,165,250,0.15); }
  }
  .stat-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: default;
  }
  .stat-card:hover {
    transform: translateY(-4px) scale(1.02);
  }
  .stat-card-blue:hover   { box-shadow: 0 8px 32px rgba(96,165,250,0.25) !important; }
  .stat-card-purple:hover { box-shadow: 0 8px 32px rgba(167,139,250,0.25) !important; }
  .stat-card-green:hover  { box-shadow: 0 8px 32px rgba(52,211,153,0.25) !important; }
  .stat-card-yellow:hover { box-shadow: 0 8px 32px rgba(251,191,36,0.25) !important; }
  .chart-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .chart-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 40px rgba(0,0,0,0.4) !important;
  }
  .container-row {
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .container-row:hover {
    background: #1f2937 !important;
    transform: translateX(4px);
  }
  .online-dot {
    animation: pulse-online 2s infinite;
  }
`;

const API = '/api';

interface Metrics {
  cpu: number;
  memoriaUsada: number;
  memoriaTotal: number;
  memoriaPorcentaje: number;
  uptime: number;
  nucleos: number;
}

interface HistorialPunto {
  tiempo: string;
  cpu: number;
  memoria: number;
}

function AnimatedNumber({ value }: { value: number | string }) {
  const [display, setDisplay] = useState<number | string>('—');

  useEffect(() => {
    if (value === '—' || value === undefined) return;
    const target = Number(value);
    if (isNaN(target)) { setDisplay(value); return; }
    let start = 0;
    const duration = 700;
    const step = 16;
    const increment = target / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, step);
    return () => clearInterval(timer);
  }, [value]);

  return <span style={{ animation: 'countUp 0.4s ease' }}>{display}</span>;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: '99px', height: '5px', marginTop: '12px', overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(value, 100)}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: '99px',
        animation: 'barFill 0.9s ease-out',
        transition: 'width 0.6s ease',
        boxShadow: `0 0 10px ${color}66`
      }} />
    </div>
  );
}

function StatCard({ title, value, sub, color, index, progress }: {
  title: string;
  value: string;
  sub: string;
  color: 'blue' | 'purple' | 'green' | 'yellow';
  index: number;
  progress?: number;
}) {
  const palette = {
    blue:   '#60a5fa',
    purple: '#a78bfa',
    green:  '#34d399',
    yellow: '#fbbf24',
  };
  const c = palette[color];

  const rawNum = value.replace('%', '').replace('h', '') || '—';
  const suffix = value !== '—' && value.includes('%') ? '%'
    : value.includes('h') && !value.includes('/') ? 'h' : '';

  return (
    <div className={`stat-card stat-card-${color}`} style={{
      background: 'linear-gradient(135deg, #1e2535 0%, #161b27 100%)',
      border: '1px solid #2d3748',
      borderRadius: '16px',
      padding: '20px',
      animation: `fadeInUp 0.5s ease ${index * 0.1}s both`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: c, animation: 'pulse-dot 2s infinite'
        }} />
        <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em' }}>{title}</span>
      </div>
      <div style={{ fontSize: '38px', fontWeight: 700, color: c, lineHeight: 1 }}>
        <AnimatedNumber value={rawNum} />{suffix}
      </div>
      <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px' }}>{sub}</div>
      {progress !== undefined && <ProgressBar value={progress} color={c} />}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [historial, setHistorial] = useState<HistorialPunto[]>([]);
  const [containers, setContainers] = useState<any[]>([]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API}/docker/metrics`);
      const data: Metrics = await res.json();
      setMetrics(data);
      const ahora = new Date();
      const label = `${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`;
      setHistorial(prev => [...prev, { tiempo: label, cpu: data.cpu, memoria: data.memoriaPorcentaje }].slice(-20));
    } catch {}
  };

  const fetchContainers = async () => {
    try {
      const res = await fetch(`${API}/docker/containers`);
      setContainers(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchMetrics();
    fetchContainers();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const corriendo = containers.filter(c => c.State === 'running').length;
  const detenidos = containers.filter(c => c.State !== 'running').length;

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1a2035',
      border: '1px solid #2d3748',
      borderRadius: '10px',
      color: '#f3f4f6',
      fontSize: '13px'
    },
    labelStyle: { color: '#9ca3af' }
  };

  return (
    <>
      <style>{styles}</style>
      <div style={{ padding: '28px', display: 'flex', flexDirection: 'column' as const, gap: '24px', maxWidth: '1200px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeInUp 0.4s ease both'
        }}>
          <div>
            <h1 style={{ color: '#f9fafb', fontSize: '26px', fontWeight: 700, margin: 0 }}>Dashboard</h1>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>Sistema en tiempo real · actualiza cada 3s</p>
          </div>
          <div style={{
            background: '#1e2535', border: '1px solid #2d3748',
            borderRadius: '20px', padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <div className="online-dot" style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#34d399'
            }} />
            <span style={{ color: '#34d399', fontSize: '12px', fontWeight: 600 }}>Online</span>
          </div>
        </div>

        {/* Tarjetas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <StatCard
            title="CPU" value={`${metrics?.cpu ?? '—'}%`}
            sub={`${metrics?.nucleos ?? '—'} núcleos`}
            color="blue" index={0} progress={metrics?.cpu}
          />
          <StatCard
            title="Memoria" value={`${metrics?.memoriaPorcentaje ?? '—'}%`}
            sub={`${metrics?.memoriaUsada ?? '—'} / ${metrics?.memoriaTotal ?? '—'} GB`}
            color="purple" index={1} progress={metrics?.memoriaPorcentaje}
          />
          <StatCard
            title="Contenedores" value={`${corriendo}`}
            sub={`${detenidos} detenidos`}
            color="green" index={2}
            progress={corriendo + detenidos > 0 ? (corriendo / (corriendo + detenidos)) * 100 : 0}
          />
          <StatCard
            title="Uptime" value={`${metrics?.uptime ?? '—'}h`}
            sub="horas encendido"
            color="yellow" index={3}
          />
        </div>

        {/* Gráficos lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* CPU */}
          <div className="chart-card" style={{
            background: 'linear-gradient(135deg, #1e2535 0%, #161b27 100%)',
            border: '1px solid #2d3748', borderRadius: '16px', padding: '20px',
            animation: 'fadeInUp 0.5s ease 0.4s both',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ color: '#f3f4f6', fontWeight: 600, fontSize: '15px' }}>CPU</span>
              <span style={{
                color: '#60a5fa', fontSize: '22px', fontWeight: 700,
                textShadow: '0 0 20px rgba(96,165,250,0.5)'
              }}>{metrics?.cpu ?? '—'}%</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={historial}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="tiempo" stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="cpu" stroke="#60a5fa" strokeWidth={2.5} fill="url(#cpuGrad)" dot={false} name="CPU" unit="%" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Memoria */}
          <div className="chart-card" style={{
            background: 'linear-gradient(135deg, #1e2535 0%, #161b27 100%)',
            border: '1px solid #2d3748', borderRadius: '16px', padding: '20px',
            animation: 'fadeInUp 0.5s ease 0.5s both',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ color: '#f3f4f6', fontWeight: 600, fontSize: '15px' }}>Memoria RAM</span>
              <span style={{
                color: '#a78bfa', fontSize: '22px', fontWeight: 700,
                textShadow: '0 0 20px rgba(167,139,250,0.5)'
              }}>{metrics?.memoriaPorcentaje ?? '—'}%</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={historial}>
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="tiempo" stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="memoria" stroke="#a78bfa" strokeWidth={2.5} fill="url(#memGrad)" dot={false} name="Memoria" unit="%" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contenedores */}
        <div className="chart-card" style={{
          background: 'linear-gradient(135deg, #1e2535 0%, #161b27 100%)',
          border: '1px solid #2d3748', borderRadius: '16px', padding: '20px',
          animation: 'fadeInUp 0.5s ease 0.6s both',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <h2 style={{ color: '#f3f4f6', fontWeight: 600, fontSize: '15px', margin: 0 }}>
              Contenedores Docker
            </h2>
            <span style={{
              background: corriendo > 0 ? '#064e3b' : '#1f2937',
              color: corriendo > 0 ? '#34d399' : '#6b7280',
              fontSize: '11px', padding: '3px 10px',
              borderRadius: '20px', fontWeight: 600,
              transition: 'all 0.3s ease'
            }}>{corriendo} activos</span>
            {detenidos > 0 && (
              <span style={{
                background: '#450a0a', color: '#f87171',
                fontSize: '11px', padding: '3px 10px',
                borderRadius: '20px', fontWeight: 600
              }}>{detenidos} detenidos</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {containers.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No hay contenedores</p>
            ) : (
              containers.map((c, i) => (
                <div key={i} className="container-row" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#111827', border: '1px solid #1f2937',
                  borderRadius: '10px', padding: '10px 16px',
                  animation: `fadeInUp 0.4s ease ${0.6 + i * 0.05}s both`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: c.State === 'running' ? '#34d399' : '#f87171',
                      animation: c.State === 'running' ? 'pulse-dot 2s infinite' : 'none',
                      boxShadow: c.State === 'running' ? '0 0 6px #34d399' : '0 0 6px #f87171'
                    }} />
                    <span style={{ color: '#e5e7eb', fontSize: '13px', fontFamily: 'monospace' }}>
                      {c.Names?.[0]?.replace('/', '') ?? c.Id?.slice(0, 12)}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                    background: c.State === 'running' ? '#064e3b' : '#450a0a',
                    color: c.State === 'running' ? '#34d399' : '#f87171'
                  }}>
                    {c.State}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  );
}