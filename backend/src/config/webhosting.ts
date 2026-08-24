// =========================================================
// WEB HOSTING MODULE CONFIG — Sitios web nativos en el host
// Cada sitio es una carpeta en el disco del servidor servida
// por Nginx del host (y php-fpm nativo si se habilita PHP).
// =========================================================

import path from 'path'

export const WEB_MODULE_CONFIG = {
  // Directorio base donde viven los sitios (disco del host)
  baseDir:
    process.env.WEB_SITES_DIR ||
    path.join(process.cwd(), '../../web-sites'),

  // Rutas de Nginx en el host
  nginxAvailable: process.env.NGINX_SITES_AVAILABLE ||
    '/etc/nginx/sites-available',
  nginxEnabled:  process.env.NGINX_SITES_ENABLED ||
    '/etc/nginx/sites-enabled',
  nginxReloadCmd: process.env.NGINX_RELOAD_CMD || 'systemctl reload nginx',

  // Binarios
  phpFpm: process.env.PHP_FPM || 'php-fpm',
  phpFpmPoolsDir: process.env.PHP_FPM_POOLS_DIR || '/etc/php/8.2/fpm/pool.d',

  // Puertos base para php-fpm por sitio
  fpmBasePort: parseInt(process.env.WEB_FPM_BASE_PORT || '9000'),
  maxInstances: 20,
} as const
