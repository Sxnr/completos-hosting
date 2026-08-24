# 🖥️ Completo Hosting Dashboard

Panel de administración self-hosted para gestionar servidores, instancias de Minecraft, bases de datos y sitios web — todo desde una interfaz web moderna.

**100% nativo, sin Docker:** cada servicio (Minecraft, PostgreSQL/MariaDB/MySQL, PHP-FPM, Nginx) corre como proceso real en tu Debian, y todos los archivos se guardan en el disco del propio servidor.

**URL de producción:** [quesitohosting.shop](https://quesitohosting.shop)

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Fastify + TypeScript + Node.js |
| Base de datos | PostgreSQL |
| Auth | JWT (jsonwebtoken) |
| Tiempo real | WebSockets (ws) + SSE |
| Process manager | PM2 |
| Reverse proxy | Nginx |
| DNS / CDN | Cloudflare |
| OS | Debian 12 |

---

## 🗺️ Roadmap

### ✅ v0.1 — Base
- [x] Arquitectura backend con Fastify
- [x] Autenticación JWT con PostgreSQL
- [x] Dashboard base con React + Vite
- [x] Despliegue en Debian 12 con PM2 + Nginx

### ✅ v0.2 — Seguridad y UX
- [x] Pantalla de Login con JWT
- [x] Rutas protegidas en el frontend
- [x] Sidebar de navegación modular
- [x] Dark mode profesional
- [x] Manejo de errores global

### ✅ v0.3 — Módulo Minecraft
- [x] Crear / iniciar / detener / reiniciar instancias
- [x] Soporte para Vanilla, Paper, Purpur, Fabric
- [x] Descarga automática de JARs con progreso en tiempo real (SSE)
- [x] Consola en tiempo real con WebSockets
- [x] Historial de consola, historial de comandos
- [x] Explorador de archivos de la instancia
- [x] Editor de server.properties con UI guiada
- [x] Monitor de jugadores conectados

### ✅ v0.4 — Módulo Bases de Datos (nativo en el host)
- [x] Crear instancias de PostgreSQL / MariaDB / MySQL (proceso real, datadir en disco)
- [x] Start / Stop / Restart por instancia
- [x] Backup (dump) y Restore (desde archivo)
- [x] Rotación de contraseña del usuario de la BD
- [ ] Interfaz tipo phpMyAdmin integrada *(futuro)*

### ✅ v0.5 — Módulo Web Hosting (nativo en el host)
- [x] Crear sitios con carpeta en el disco y configuración de Nginx del host
- [x] File manager (listar / leer / escribir / subir / borrar) en el disco del server
- [x] Publicar / detener (enable/disable en Nginx)
- [x] Soporte PHP con php-fpm nativo (pool por sitio)
- [ ] Certificados SSL con Let's Encrypt *(futuro)*

### 🔄 v0.6 — Monitoreo Avanzado *(próximo)*
- [x] Gráficos en tiempo real (CPU, RAM, Red, Disco)
- [ ] Alertas por uso excesivo de recursos
- [ ] Historial de métricas con retención configurable
- [ ] Integración con Prometheus + Grafana

### 🔄 v1.0 — Plataforma Completa *(futuro)*
- [ ] Sistema de roles y permisos (admin, user, viewer)
- [ ] Auto-deploy desde GitHub via webhooks
- [ ] API pública documentada con Swagger
- [ ] CLI para gestión desde terminal

---

## 📁 Estructura del proyecto

```
completo-hosting/
├── backend/                  # API Fastify + WebSocket
│   ├── src/
│   │   ├── config/           # Config centralizada (minecraft, databases, webhosting)
│   │   ├── minecraft/        # MinecraftManager + MinecraftInstance
│   │   ├── routes/           # Rutas REST (auth, metrics, minecraft, power, databases, web)
│   │   ├── services/         # Lógica nativa (system, processes, power, databases, webhosting)
│   │   ├── plugins/          # db.ts (pool PostgreSQL)
│   │   ├── scripts/          # create-admin.ts (crea el admin inicial)
│   │   ├── index.ts          # Entry point + bootstrap
│   │   └── types/            # Tipos compartidos
│   ├── sql/                  # Esquemas SQL (schema.sql, schema_modules.sql)
│   ├── .env                  # Variables de entorno (no commitear)
│   └── package.json
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   ├── hooks/            # Custom hooks (useMinecraftConsole, useMetrics, etc.)
│   │   ├── layouts/          # DashboardLayout
│   │   ├── pages/            # Overview, Minecraft, Databases, Web, Power, Settings, etc.
│   │   ├── services/         # api.ts (Axios) + auth/databases/web/power
│   │   └── styles/           # CSS por módulo
│   ├── .env                  # Variables de entorno frontend
│   └── package.json
│
├── ecosystem.config.js       # Configuración PM2
├── nginx.conf                # Configuración Nginx
└── README.md
```

---

## ⚙️ Instalación local

### Requisitos
- Node.js 20+
- PostgreSQL 15+
- npm 10+

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/completo-hosting.git
cd completo-hosting
```

### 2. Configurar el backend

```bash
cd backend
cp .env.example .env
# Edita .env con tus credenciales de PostgreSQL y JWT_SECRET
npm install
# Crea la base de datos y las tablas (una sola vez):
#   psql -U postgres -c "CREATE DATABASE completos_hosting;"
#   psql -U postgres -d completos_hosting -f sql/schema.sql
# Crea el usuario admin inicial:
#   npx tsx scripts/create-admin.ts
npm run dev
```

### 3. Configurar el frontend

```bash
cd frontend
cp .env.example .env
# Edita .env con la URL del backend
npm install
npm run dev
```

### 4. Variables de entorno

**backend/.env**
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/completo_hosting
JWT_SECRET=tu_secreto_super_seguro
PORT=3001
MC_SERVERS_DIR=/opt/completo-hosting/minecraft/servers
MC_JARS_DIR=/opt/completo-hosting/minecraft/jars
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 🚀 Deploy en producción (Debian 12)

### 1. Clonar en el servidor

```bash
cd /opt
git clone https://github.com/TU_USUARIO/completo-hosting.git
cd completo-hosting
```

### 2. Instalar dependencias y build

```bash
# Backend
cd backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build
```

### 3. Configurar variables de entorno de producción

```bash
# backend/.env
nano backend/.env
```

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/completo_hosting
JWT_SECRET=CAMBIA_ESTO_POR_UN_SECRET_SEGURO
PORT=3001
NODE_ENV=production
MC_SERVERS_DIR=/opt/completo-hosting/minecraft/servers
MC_JARS_DIR=/opt/completo-hosting/minecraft/jars
# Control de energía (Wake-on-LAN + apagado del SO)
POWER_DRIVER=wol
POWER_WOL_MAC=AA:BB:CC:DD:EE:FF
POWER_WOL_BROADCAST=255.255.255.255
POWER_WOL_PORT=9
POWER_OFF_COMMAND=systemctl poweroff

# Módulo Bases de Datos (nativo)
DB_INSTANCES_DIR=/opt/completo-hosting/db
DB_BASE_PORT=3306
PG_INITDB=/usr/lib/postgresql/16/bin/initdb
PG_SERVER=/usr/lib/postgresql/16/bin/postgres
MARIADB_SERVER=mariadbd
MYSQL_SERVER=mysqld

# Módulo Web Hosting (nativo)
WEB_SITES_DIR=/opt/completo-hosting/web
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
NGINX_RELOAD_CMD=systemctl reload nginx
PHP_FPM=/usr/sbin/php-fpm8.2
PHP_FPM_POOLS_DIR=/etc/php/8.2/fpm/pool.d
WEB_FPM_BASE_PORT=9000
```

```bash
# frontend/.env
nano frontend/.env
```

```env
VITE_API_URL=https://quesitohosting.shop
VITE_WS_URL=wss://quesitohosting.shop
```

### 4. Levantar con PM2

```bash
# Desde la raíz del proyecto
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configurar Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/quesitohosting
sudo ln -s /etc/nginx/sites-available/quesitohosting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Cloudflare

En el panel de Cloudflare:
- Apunta el dominio `quesitohosting.shop` a la IP de tu servidor Debian
- Activa el proxy (nube naranja) ✅
- SSL/TLS → modo **Full**

---

## 🔄 Actualizar en producción

```bash
cd /opt/completo-hosting
git pull origin main

# Rebuild backend
cd backend && npm install && npm run build

# Rebuild frontend
cd ../frontend && npm install && npm run build

# Reiniciar servicios
pm2 restart all
```

---

## 📜 Licencia

MIT © Completo Hosting
