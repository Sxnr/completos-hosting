// =========================================================
// BOTS MODULE CONFIG — Hosting de bots (Discord/Node) 24/7
// Cada bot es una carpeta en el disco del host ejecutada
// como proceso supervisado (autoreinicio + arranque en reboot).
// =========================================================

import path from 'path'

export const BOT_CONFIG = {
  // Directorio base donde viven los bots (disco del host)
  baseDir:
    process.env.BOTS_DIR ||
    path.join(process.cwd(), 'bots'),

  // Comando de arranque por defecto (puede sobreescribirse por bot)
  defaultRunCommand: process.env.BOT_RUN_CMD || 'npm start',

  // Máximo de líneas de consola en memoria por bot
  logRetention: 2000,

  // Límites del supervisor
  restartBackoffBaseMs: 2000,
  crashLoopWindowMs: 60_000,
  crashLoopMaxRestarts: 6,
} as const
