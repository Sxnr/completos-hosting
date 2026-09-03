// =========================================================
// QUESI-CAT — La mascota interactiva de Quesito Hosting
// Un gato minimalista (SVG) que cambia de aspecto según la
// ruta activa y el estado del supervisor PM2.
//
//  - neutral    → observa métricas generales
//  - bots       → con auriculares, gestionando bots Discord/Node
//  - minecraft  → con pico y acentos naranjas
//  - alert      → proceso caído / crash-loop (sorpresa)
//
// Usa la store de Zustand para el estado global y Framer Motion
// para transiciones suaves de aspecto y posición.
// =========================================================

import { motion } from 'framer-motion'
import { useQuesiCatStore, type QuesiCatMode } from '../stores/quesiCatStore'

// Accesorios visuales por modo de la mascota
const MODE_CONF: Record<
  QuesiCatMode,
  { body: string; darkBody: string; accent: string; label: string }
> = {
  neutral:    { body: '#ffb347', darkBody: '#e8890f', accent: '#ffd23f', label: 'Observando métricas…' },
  bots:       { body: '#ff9f1c', darkBody: '#d97a00', accent: '#5ad7de', label: 'Gestionando bots 🎧' },
  minecraft:  { body: '#ffd23f', darkBody: '#c99400', accent: '#ff9f1c', label: 'Minando bloque… ⛏️' },
  alert:      { body: '#ff6b5e', darkBody: '#e0483a', accent: '#ffd23f', label: '¡Alerta! Proceso caído' },
}

// Transición de fondo suave al cambiar de modo
export default function QuesiCat() {
  const { mode, hasError, revealed, alerts } = useQuesiCatStore();
  const isAlert = mode === 'alert' || hasError;
  const label = isAlert
    ? MODE_CONF.alert.label
    : MODE_CONF[mode].label;

  const alertNames = alerts.map((a) => a.name).join(', ');

  return (
    <div
      className="flex flex-col items-center gap-2"
      // Anuncio accesible: lectores de pantalla notifican el cambio
      // de estado del supervisor sin intervención del usuario (ISO 9241)
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={isAlert ? `${label}. ${alertNames}` : label}
    >
      <motion.div
        className={`
          relative select-none rounded-2xl p-1
          ${isAlert
            ? 'animate-pulse-glow'
            : 'drop-shadow-quesito'}
        `}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, y: revealed ? 0 : 12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.06, rotate: isAlert ? 0 : -3 }}
      >
        <motion.svg
          key={mode}
          width="54"
          height="54"
          viewBox="0 0 64 64"
          fill="none"
          initial={{ rotateY: -20, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          {/* ─── Cuerpo: silueta de gato ─── */}
          <motion.path
            d="M14 40 C12 28 20 20 32 20 C44 20 52 28 50 40 C50 48 42 54 32 54 C22 54 14 48 14 40 Z"
            fill={MODE_CONF[mode].body}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          />

          {/* ─── Orejas ─── */}
          <path d="M20 26 L15 12 L28 20 Z" fill={MODE_CONF[mode].body} />
          <path d="M44 26 L49 12 L36 20 Z" fill={MODE_CONF[mode].body} />
          {mode === 'minecraft' && (
            <>
              {/* Pico (minecraft) */}
              <path
                d="M22 46 L32 44 L42 46 L32 54 Z"
                fill="#6b4a2b"
                stroke="#4a2f10"
                strokeWidth="1"
              />
              <path d="M22 46 L32 44 L32 54 Z" fill="#8a6a3b" />
            </>
          )}

          {/* ─── Ojos según estado ─── */}
          <Eyes isAlert={isAlert} />

          {/* ─── Nariz ─── */}
          <path d="M30 36 L34 36 L32 39 Z" fill="#5a3410" />

          {/* ─── Bigotes ─── */}
          {!isAlert && (
            <g stroke="#5a3410" strokeWidth="1.6" strokeLinecap="round">
              <line x1="22" y1="36" x2="12" y2="34" />
              <line x1="22" y1="39" x2="12" y2="41" />
              <line x1="42" y1="36" x2="52" y2="34" />
              <line x1="42" y1="39" x2="52" y2="41" />
            </g>
          )}

          {/* ─── Accesorio por modo ─── */}
          {mode === 'bots' && (
            // Auriculares
            <g>
              <path
                d="M16 38 a16 16 0 0 1 32 0"
                stroke="#ffffff"
                strokeWidth="3"
                fill="none"
              />
              <circle cx="13" cy="40" r="3.5" fill="#ffffff" />
              <circle cx="51" cy="40" r="3.5" fill="#ffffff" />
              <circle cx="13" cy="40" r="1.2" fill={MODE_CONF[mode].accent} />
              <circle cx="51" cy="40" r="1.2" fill={MODE_CONF[mode].accent} />
            </g>
          )}
          {mode === 'minecraft' && (
            // Casco de minero + acento naranja
            <g stroke="#ff9f1c" strokeWidth="2" fill="none">
              <path d="M22 26 L32 24 L42 26" />
              <path d="M24 26 L24 30" />
              <path d="M40 26 L40 30" />
            </g>
          )}
        </motion.svg>
      </motion.div>

      {/* Etiqueta flotante sutil del estado del gato */}
      {revealed && (
        <motion.span
          className="font-mono text-[10px] tracking-wide opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.4 }}
        >
          {label}
        </motion.span>
      )}

      {/* Badge de alerta — visible y accesible cuando hay proceso caído */}
      {isAlert && alerts.length > 0 && (
        <span
          className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-red-400"
          role="img"
          aria-label={`Proceso caído: ${alertNames}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
          {alerts.length === 1 ? alerts[0].name : `${alerts.length} procesos caídos`}
        </span>
      )}
    </div>
  )
}

// ── Ojos: reaccionan a alerta / parpadeo ──
function Eyes({ isAlert }: { isAlert: boolean }) {
  const eyes = useQuesiCatStore((s) => s.eyes)
  const closed = eyes === 'closed'

  if (isAlert) {
    // Ojos grandes de sorpresa
    return (
      <g>
        <circle cx="26" cy="31" r="4.5" fill="#2a1804" />
        <circle cx="38" cy="31" r="4.5" fill="#2a1804" />
        <circle cx="27" cy="29.5" r="1.5" fill="#fff" />
        <circle cx="39" cy="29.5" r="1.5" fill="#fff" />
      </g>
    )
  }

  if (closed) {
    // Ojos cerrados (tapa ojos al escribir contraseña)
    return (
      <g stroke="#2a1804" strokeWidth="2" strokeLinecap="round">
        <line x1="22" y1="31" x2="30" y2="31" />
        <line x1="34" y1="31" x2="42" y2="31" />
      </g>
    )
  }

  return (
    <g>
      <circle cx="26" cy="30" r="2.6" fill="#2a1804" />
      <circle cx="38" cy="30" r="2.6" fill="#2a1804" />
    </g>
  )
}
