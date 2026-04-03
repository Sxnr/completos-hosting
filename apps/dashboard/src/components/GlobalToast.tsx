import { useEffect, useState } from 'react';

export default function GlobalToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    window.addEventListener('app:error', handler);
    return () => window.removeEventListener('app:error', handler);
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#1f1f23', border: '1px solid #f87171', color: '#fca5a5',
          padding: '12px 16px', borderRadius: 10, fontSize: 13,
          fontFamily: 'monospace', maxWidth: 320, animation: 'fadeUp .2s ease',
          boxShadow: '0 8px 24px rgba(0,0,0,.5)'
        }}>
          ⚠️ {t.msg}
        </div>
      ))}
    </div>
  );
}