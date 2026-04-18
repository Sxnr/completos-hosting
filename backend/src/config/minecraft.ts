// =========================================================
// MINECRAFT CONFIG — Configuración centralizada del módulo
// =========================================================

import path from 'path'

export const MC_CONFIG = {
  // Directorios base
  serversDir: process.env.MINECRAFT_DIR
    || path.join(process.cwd(), '../../minecraft-servers'),

  jarsDir: process.env.MINECRAFT_JARS_DIR
    || path.join(process.cwd(), '../../minecraft-jars'),

  // Java
  javaExecutable: process.env.JAVA_EXECUTABLE || 'java',

  // Puerto base — se autoincrementa por instancia
  basePort: parseInt(process.env.MINECRAFT_BASE_PORT || '25565'),

  // Máximo de instancias simultáneas corriendo
  maxRunningInstances: 5,

  // Máximo de líneas de consola en memoria por instancia
  maxConsoleLines: 300,

  // Timeout para detener un servidor (ms) antes de forzar kill
  stopTimeoutMs: 30_000,

  // Software soportado con sus etiquetas para la UI
  software: {
    java: [
      { id: 'vanilla',   label: 'Vanilla',    hasPlugins: false, hasMods: false },
      { id: 'paper',     label: 'Paper',       hasPlugins: true,  hasMods: false },
      { id: 'spigot',    label: 'Spigot',      hasPlugins: true,  hasMods: false },
      { id: 'purpur',    label: 'Purpur',      hasPlugins: true,  hasMods: false },
      { id: 'fabric',    label: 'Fabric',      hasPlugins: false, hasMods: true  },
      { id: 'quilt',     label: 'Quilt',       hasPlugins: false, hasMods: true  },
      { id: 'forge',     label: 'Forge',       hasPlugins: false, hasMods: true  },
      { id: 'neoforge',  label: 'NeoForge',    hasPlugins: false, hasMods: true  },
      { id: 'arclight',  label: 'Arclight',    hasPlugins: true,  hasMods: true  },
    ],
    bedrock: [
      { id: 'bedrock',    label: 'Bedrock',         hasPlugins: false, hasMods: false },
      { id: 'pocketmine', label: 'PocketMine-MP',   hasPlugins: true,  hasMods: false },
    ],
  },

  // server.properties por defecto para nuevas instancias
  defaultProperties: {
    'motd':                     'Un servidor de Minecraft',
    'max-players':              20,
    'online-mode':              true,
    'white-list':               false,
    'gamemode':                 'survival',
    'difficulty':               'normal',
    'spawn-protection':         16,
    'allow-flight':             false,
    'pvp':                      true,
    'enable-command-block':     false,
    'level-name':               'world',
    'level-seed':               '',
    'view-distance':            10,
    'simulation-distance':      10,
    'max-tick-time':            60000,
    'resource-pack':            '',
    'resource-pack-prompt':     '',
    'require-resource-pack':    false,
  },
} as const