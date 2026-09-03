// =========================================================
// MINECRAFT CONFIG — Configuración centralizada del módulo
// =========================================================

import path from 'path'

// Dominio raíz editable por entorno (por defecto el de la marca)
export const MC_DOMAIN = process.env.MC_DOMAIN || 'quesitohosting.shop'

export const MC_CONFIG = {
  // Directorios base
  serversDir: process.env.MC_SERVERS_DIR
    || process.env.MINECRAFT_DIR
    || path.join(process.cwd(), '../../minecraft-servers'),

  jarsDir: process.env.MC_JARS_DIR
    || process.env.MINECRAFT_JARS_DIR
    || path.join(process.cwd(), '../../minecraft-jars'),

  // Java
  javaExecutable: process.env.JAVA_EXECUTABLE || 'java',

  // Puerto base — se autoincrementa por instancia
  basePort: parseInt(process.env.MINECRAFT_BASE_PORT || '25565'),

  // ── Sistema de dominios y puertos (Red y Dominio) ─────────
  // Dominio raíz: "<subdomain>.<MC_DOMAIN>"
  domain: MC_DOMAIN,

  // Nube de resolución: hasta dónde escanear desde basePort buscando un
  // puerto libre (evita bucles infinitos).
  portScanLimit: parseInt(process.env.MC_PORT_SCAN_LIMIT || '100'),

  // IP pública de respaldo. Si no se usa túnel (PUBLIC_IP vacía) el SRV
  // apunta a esta IP; si no está definida y no hay túnel, solo se crea el
  // CNAME y se advierte.
  publicIp: process.env.PUBLIC_IP || '',

  // ── Cloudflare (DNS + Tunnel) ─────────────────────────────
  // Token de la API con permisos de edición DNS y Zero Trust.
  cfToken: process.env.CLOUDFLARE_API_TOKEN || '',
  // ID de la zona (subdominio de nivel superior, ej. quesitohosting.shop).
  cfZoneId: process.env.CLOUDFLARE_ZONE_ID || '',
  // ID de la cuenta de Cloudflare (necesario para gestionar el Public
  // Hostname TCP del túnel vía la API de Zero Trust).
  cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',

  // Túnel cloudflared:
  //  - CLOUDFLARE_TUNNEL: nombre o UUID del túnel cloudflared a usar.
  //  - CLOUDFLARE_TUNNEL_CONFIG: ruta a config.yml del túnel (opt).
  //  - CLOUDFLARE_TUNNEL_LOCAL_DOMAIN: si el túnel ya gestiona wildcard,
  //    cada hostname <sub>.<MC_DOMAIN> enruta por el túnel sin tocar la
  //    config (opcional).
  cfTunnel: process.env.CLOUDFLARE_TUNNEL || '',
  cfTunnelConfig: process.env.CLOUDFLARE_TUNNEL_CONFIG
    || process.env.HOME + '/.cloudflared/config.yml',
  cfTunnelLocalDomain: process.env.CLOUDFLARE_TUNNEL_LOCAL_DOMAIN || '',

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