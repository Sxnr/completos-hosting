# 🧇 Quesito Hosting — Dashboard

Panel de administración **self-hosted** para gestionar servidores, instancias de Minecraft, bases de datos, sitios web y **bots 24/7** (Discord / Node) — todo desde una interfaz web moderna, cálida y **galardonable** (estilo Awwwards).

> **100% nativo, sin Docker.** Cada servicio (Minecraft, PostgreSQL/MariaDB/MySQL, PHP-FPM, Nginx, bots) corre como proceso real en tu Debian y todos los archivos se guardan en el disco del propio servidor.

**URL de producción:** [quesitohosting.shop](https://quesitohosting.shop)

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Fastify + TypeScript + Node.js |
| Base de datos | PostgreSQL (metadata, usuarios, config) |
| Auth | JWT (`@fastify/jwt` + `bcrypt`) |
| UI / Estilos | **Tailwind CSS** + CSS custom (design system dual-theme) |
| Estado global | **Zustand** |
| Animaciones | **Framer Motion** |
| Tiempo real | WebSockets (`ws`) + SSE |
| Process manager | PM2 |
| Reverse proxy | Nginx + Cloudflare Tunnel |
| OS | Debian 12 |

---

## 🎨 Sistema de diseño "Quesito" — Dual Theme

Interfaz **Glassmorphism de alto contraste** con soporte completo de **Modo Claro y Modo Oscuro** (toggle en el sidebar, `darkMode: 'class'`).

**Modo Oscuro (por defecto):**
- Fondos abisales (`#0a0a0a`) con textos gris-blanco de **máximo contraste**.

**Modo Claro:**
- Fondos limpios y suaves (`#f7f3ec`) con textos oscuros nítidos.

**Paleta de marca bloqueada** (solo tonos "Quesito"):
- Naranja `#ff9f1c` y amarillo `#ffd23f`.
- Usados estratégicamente en botones, estados activos y **glows difuminados** sin comprometer la legibilidad.

**Tipografía:**
- **Clash Display** (geométrica) para títulos.
- **Inter** para el cuerpo.
- **JetBrains Mono** para consolas WebSocket y código/terminales.

---

## 🐈‍⬛ La mascota "Quesi-Cat"

Un gato minimalista (SVG) que vive en el sidebar y **cambia de aspecto según la ruta activa**, gestionado por un store global de Zustand:

| Contexto | Estado del Quesi-Cat |
|---|---|
| Ruta general | 😐 Neutral — observa métricas generales |
| `/bots` | 🎧 Con auriculares — gestionando bots de Discord/Node |
| `/minecraft` | ⛏️ Con pico y acentos naranjas — minando bloque |
| Error PM2 (proceso caído / crash-loop) | 😮 Alerta / sorpresa |

**Comportamientos interactivos:**
- En el **login**, sigue la posición del cursor y la longitud del texto del usuario.
- **Se tapa los ojos** cuando el foco está en el input de contraseña.
- Al iniciar sesión, viaja fluidamente desde el centro del login hasta su posición en el sidebar (transición Framer Motion, sin recargar la página).

> La mascota se puede ampliar: `stores/quesiCatStore.ts` expone `reportError()` para que el supervisor PM2 ponga al gato en estado de alerta ante procesos caídos.

**Monitoreo conectado al PM2 (en vivo):**
- El hook global `useQuesiCatAlerts` (montado en el `DashboardLayout`) sondea `/api/bots` cada 5s.
- Si algún bot entra en estado `crashed` o `stopping` (crash-loop), el gato pasa a **alerta** automáticamente y muestra un **badge accesible** con el nombre del proceso caído.
- Anuncio a lectores de pantalla vía `aria-live="polite"` (WCAG / ISO 9241-110).

---

## ♿ Calidad y accesibilidad (ISO)

El frontend se rige por estándares ISO de calidad de producto y ergonomía:

### ISO/IEC 25010 — Calidad del producto
- **Funcionalidad:** el monitoreo del Quesi-Cat refleja el estado real del supervisor (no es decorativo).
- **Mantenibilidad:** lógica de estado aislada en stores de Zustand y hooks dedicados (`useQuesiCatAlerts`), UI separada en componentes reutilizables (`ConsoleLine`, `Skeleton`, `EmptyState`).
- **Usabilidad:** feedback claro en carga/error/vacío en todos los módulos.

### ISO 9241-110 — Ergonomía de interacción
- **Feedback del sistema:** skeletons y estados de vacío informan de que hay contenido en camino.
- **Visibilidad de estado:** el Quesi-Cat y los indicadores WS/online/offline informan proactivamente.
- **Reducción de movimiento:** las animaciones (consola, skeletons) respetan `prefers-reduced-motion`.

### ISO/IEC 40500 (WCAG 2.1) — Accesibilidad web
- **Contraste AA/AAA:** texto siempre distintivo del fondo en ambos temas (no depende solo del color).
- **Contenido perceptible:** `aria-live` para alertas del supervisor, `aria-label` y `role="status"` en componentes dinámicos.
- **Operable por teclado:** navegación del sidebar sin mouse, foco visible con anillo `:focus-visible`.

---

## 🗺️ Roadmap

### ✅ v0.1 — Base
- [x] Arquitectura backend con Fastify + WebSocket
- [x] Autenticación JWT con PostgreSQL
- [x] Dashboard base con React + Vite
- [x] Despliegue en Debian 12 con PM2 + Nginx + Cloudflare

### ✅ v0.2 — Seguridad y UX
- [x] Pantalla de Login y rutas protegidas
- [x] Sidebar de navegación modular (colapsable)
- [x] Manejo de errores global + toasts + indicador de conexión WS
- [x] ErrorBoundary para evitar pantallas en blanco

### ✅ v0.3 — Módulo Minecraft
- [x] Crear / iniciar / detener / reiniciar instancias
- [x] Vanilla, Paper, Purpur, Fabric, Forge (descarga de JARs con progreso SSE)
- [x] Consola en tiempo real (WebSocket) + historial + historial de comandos
- [x] Explorador de archivos y editor `server.properties` guiado
- [x] Monitor de jugadores conectados

### ✅ v0.4 — Módulo Bases de Datos (nativo)
- [x] PostgreSQL / MariaDB / MySQL como proceso real (datadir en disco)
- [x] Start / Stop / Restart por instancia
- [x] Backup (`dump`) y Restore
- [x] Rotación de contraseña de usuario
- [ ] Interfaz tipo phpMyAdmin/Adminer integrada *(futuro)*

### ✅ v0.5 — Módulo Web Hosting (nativo)
- [x] Sitios con carpeta en disco + configuración Nginx del host
- [x] File manager (listar / leer / escribir / subir / borrar)
- [x] Publicar / detener (enable/disable en Nginx)
- [x] PHP con php-fpm nativo (pool por sitio)
- [ ] Certificados SSL automáticos con Let's Encrypt *(futuro)*

### ✅ v0.6 — Monitoreo y Procesos
- [x] Gráficos en tiempo real (CPU, RAM, Red) vía SSE
- [x] **Multi-disco**: métricas por disco duro (`getDisks`)
- [x] Módulo Power (Wake-on-LAN + apagado del host, driver HTTP opcional)
- [x] Módulo Processes (listado de procesos del SO)
- [x] Módulo Settings (gestión de usuarios admin/user + perfil)

### ✅ v0.7 — Módulo Bots 24/7
- [x] Crear bots desde repositorio Git (`git clone`) o subida manual de archivos
- [x] `npm install` automático (con `--omit=dev`) tras clonar
- [x] Registro automático de slash commands (`npm run deploy`) una vez
- [x] Supervisor: autoreinicio en caídas + protección anti bucle (crash-loop)
- [x] Auto-arranque de bots al iniciar el backend (y con PM2 en reboot)
- [x] Consola en tiempo real (WebSocket) por bot
- [x] File manager del bot + editor de `.env` crudo (variables de entorno)
- [x] **Mantenimiento**: `git pull` (normal y forzado), install de deps, Rebuild, Restart+install, y **Redeploy** (pull + install + build + restart)
- [x] **Kill del árbol de procesos**: al detener, mata todo el árbol hijo (node/Discord) vía grupo + `/proc`
- [x] Acciones: Iniciar / Detener / Reiniciar / `git pull` / enviar comandos

### ✅ v0.8 — Rediseño Frontend (Dual Theme + Mascota) *(nuevo)*
- [x] Migración a **Tailwind CSS** (`darkMode: 'class'`)
- [x] **Modo Oscuro** abisal + **Modo Claro** limpio con legibilidad estricta
- [x] Sistema de diseño **Glassmorphism** de alto contraste
- [x] Paleta de marca bloqueada a tonos Quesito (naranja + amarillo)
- [x] Tipografía **Clash Display** (títulos) + JetBrains Mono (consolas)
- [x] Estado global con **Zustand** (tema + mascota)
- [x] **Login interactivo** con Quesi-Cat que sigue cursor/teclado y se tapa los ojos
- [x] Transición de login → dashboard con **Framer Motion** (sin recargar)
- [x] Mascota **Quesi-Cat** en sidebar con estados por ruta (`/bots`, `/minecraft`, neutral, alerta)
- [x] Animaciones de layout y navegación entre módulos (fade + desplazamiento Y)
- [ ] CSS modules / purga final de estilos legacy no usados *(en curso)*
- [ ] Conectar `reportError()` del Quesi-Cat con el feed de eventos PM2 en tiempo real *(futuro)*
- [ ] Transiciones animadas en los mensajes de consola WebSocket entrantes *(futuro)*

### 🔄 Próximas mejoras
- [ ] Certificados SSL con Let's Encrypt (módulo Web)
- [ ] phpMyAdmin/Adminer integrado (módulo Bases de Datos)
- [ ] Alertas por uso excesivo de CPU/RAM/Disco
- [ ] Historial de métricas con retención configurable + Prometheus/Grafana
- [ ] Auto-deploy desde GitHub vía webhooks
- [ ] API pública documentada con Swagger
- [ ] Roles granulares (admin, user, viewer) y permisos por módulo
- [ ] CLI `quesito` para gestión desde terminal
- [ ] Marketplace de plantillas de bots (Discord.js, mineflayer, etc.)
- [ ] Logs persistentes por bot con descarga/rotación
- [ ] Backup programado de bots y mundos de Minecraft

---

## 🤖 Módulo Bots — detalle

Cada bot es una **carpeta en el disco del host** (`/opt/completo-hosting/backend/bots/bot_<id>`) ejecutada como proceso supervisado. No usa contenedores.

**Ciclo de vida**
1. Se crea la carpeta y (si es Git) se clona el repo.
2. Se instalan dependencias (`npm install --omit=dev`).
3. Si el repo define `deploy`, se registran los slash commands una vez.
4. El bot arranca con el comando configurado (por defecto `npm start`).
5. Si el proceso cae, el supervisor lo reinicia (con backoff y límite anti-bucle).
6. Con `autostart` activado, el bot se levanta solo al reiniciar el backend (y con PM2 en el arranque del servidor).

**Variables de entorno**
- Se editan en la pestaña **Configuración** del bot (editor crudo de `.env`).
- Tu bot de Discord requiere `TOKEN` y `CLIENT_ID` en formato `CLAVE=valor`.
- Se guardan solo en el servidor (nunca se envían al frontend).
- Si un bot usa módulos nativos (`better-sqlite3`, `canvas`, etc.), el host debe tener las herramientas de compilación:
  ```bash
  apt-get install -y python3 make g++ build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
  ```

**Endpoints (REST + WS)**
`GET /api/bots` · `POST /api/bots` · `GET /api/bots/:id` · `DELETE /api/bots/:id` · `:id/start|stop|restart|pull|pull|force|install|rebuild|restart-install|redeploy` · `:id/env` (GET/PUT) · `:id/command` · `:id/console` · `:id/console/ws` (WebSocket) · `:id/files` · `:id/file` (GET/PUT/DELETE) · `:id/upload`.

---

## 📁 Estructura del proyecto

```
quesito-hosting/
├── backend/                  # API Fastify + WebSocket
│   ├── src/
│   │   ├── config/           # Config centralizada (minecraft, databases, webhosting, bots)
│   │   ├── minecraft/        # MinecraftManager + MinecraftInstance
│   │   ├── bots/             # BotManager (supervisor + file manager + console)
│   │   ├── services/         # Lógica nativa (system, processes, power, databases, webhosting, PlayitManager)
│   │   ├── routes/           # REST: auth, metrics, minecraft, bots, power, databases, web, processes, settings
│   │   ├── plugins/          # db.ts (pool PostgreSQL)
│   │   ├── scripts/          # create-admin.ts (crea el admin inicial)
│   │   ├── index.ts          # Entry point (dist/index.js)
│   │   └── types/            # Tipos compartidos
│   ├── sql/                  # schema.sql, schema_modules.sql
│   ├── .env / .env.example
│   └── package.json
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # UI reutilizable (Toast, ConnectionStatus, ErrorBoundary, QuesiCat, etc.)
│   │   ├── stores/           # Zustand: themeStore, quesiCatStore (estado global)
│   │   ├── hooks/            # useMinecraftConsole, useBotsConsole, useMetrics, useProcesses, useSettings
│   │   ├── layouts/          # DashboardLayout (sidebar modular + Quesi-Cat + theme toggle)
│   │   ├── pages/            # Dashboard, Minecraft, MinecraftDetail, Databases, Web, Power, Processes, Settings, Bots, BotsDetail, Login
│   │   ├── services/         # api.ts (Axios) + bots, databases, web, power, auth
│   │   └── styles/           # CSS por módulo (variables.css = design system "Quesito" dual-theme)
│   ├── tailwind.config.js    # darkMode: 'class' + paleta Quesito
│   ├── postcss.config.js     # Tailwind + Autoprefixer
│   ├── .env / .env.example
│   └── package.json
│
├── ecosystem.config.js        # Configuración PM2 (app: completo-hosting-backend)
├── nginx.conf                 # Configuración Nginx
└── README.md
```

---

## ⚙️ Instalación local (desarrollo)

### Requisitos
- Node.js 20+
- PostgreSQL 15+
- npm 10+
- Java (solo para Minecraft), php-fpm + nginx (solo para Web Hosting)

### 1. Clonar
```bash
git clone https://github.com/Sxnr/quesito-hosting.git
cd quesito-hosting
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edita .env (DB_*, JWT_SECRET, rutas de módulos)
npm install
# Crea la base de datos y tablas (una vez):
#   psql -U postgres -c "CREATE DATABASE quesito_hosting;"
#   psql -U postgres -d quesito_hosting -f sql/schema.sql
# Crea el usuario admin inicial:
#   npm run create-admin
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3001 · VITE_WS_URL=ws://localhost:3001
npm install
npm run dev
```

---

## 🚀 Deploy en producción (Debian 12)

### 1. Clonar
```bash
cd /opt
git clone https://github.com/Sxnr/quesito-hosting.git
cd quesito-hosting
```

### 2. Build
```bash
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build
```
> Usa `npm ci` para reproducibilidad exacta del `package-lock.json` (debe estar commiteado). Si prefieres conservar dependencias ya instaladas, usa `npm install`.

### 3. Variables de entorno

**backend/.env**
```env
HOST=0.0.0.0
PORT=3001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=quesito_hosting
DB_USER=quesito
DB_PASSWORD=tu_password

JWT_SECRET=cambia_esto_por_un_secreto_largo_y_seguro
JWT_EXPIRES_IN=8h

# Minecraft
MC_SERVERS_DIR=/opt/quesito-hosting/minecraft/servers
MC_JARS_DIR=/opt/quesito-hosting/minecraft/jars
JAVA_EXECUTABLE=java
MINECRAFT_BASE_PORT=25565

# Bots
BOTS_DIR=/opt/quesito-hosting/backend/bots
BOT_RUN_CMD=npm start

# Power (Wake-on-LAN + apagado host)
POWER_DRIVER=wol
POWER_WOL_MAC=AA:BB:CC:DD:EE:FF
POWER_WOL_BROADCAST=255.255.255.255
POWER_WOL_PORT=9
POWER_OFF_COMMAND=systemctl poweroff

# Bases de datos (nativo)
DB_INSTANCES_DIR=/opt/quesito-hosting/db
DB_BASE_PORT=3306
PG_INITDB=/usr/lib/postgresql/16/bin/initdb
PG_SERVER=/usr/lib/postgresql/16/bin/postgres
MARIADB_SERVER=mariadbd
MYSQL_SERVER=mysqld

# Web Hosting (nativo)
WEB_SITES_DIR=/opt/quesito-hosting/web
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
NGINX_RELOAD_CMD=systemctl reload nginx
PHP_FPM=/usr/sbin/php-fpm8.2
PHP_FPM_POOLS_DIR=/etc/php/8.2/fpm/pool.d
WEB_FPM_BASE_PORT=9000
```

**frontend/.env**
```env
VITE_API_URL=https://quesitohosting.shop
VITE_WS_URL=wss://quesitohosting.shop
```

### 4. PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx
```bash
sudo cp nginx.conf /etc/nginx/sites-available/quesitohosting
sudo ln -s /etc/nginx/sites-available/quesitohosting /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Cloudflare
- Apunta `quesitohosting.shop` a la IP de tu servidor (o usa Cloudflare Tunnel si no tienes IPv4 público).
- Activa el proxy (nube naranja) ✅ y SSL/TLS en modo **Full**.

---

## 🔄 Actualizar en producción

```bash
cd /opt/quesito-hosting
git pull origin main

# Backend
cd backend && npm ci && npm run build && pm2 restart completo-hosting-backend

# Frontend (Nginx sirve el build estático)
cd ../frontend && npm ci && npm run build
```
> El frontend lo sirve Nginx de forma estática; tras `npm run build` no hace falta reiniciar PM2. Recarga el panel con **Ctrl+F5** para evitar caché.
> Si iniciaste el backend con otro nombre de PM2 (p. ej. `completo-backend`), usa ese nombre en el comando `pm2 restart`.

---

## 👤 Usuarios y roles
- Roles: `admin` (acceso total) y `user`.
- El admin inicial se crea con `npm run create-admin`.
- Desde **Settings** un admin puede crear/eliminar usuarios y cambiar contraseñas.

---

## 📜 Licencia
MIT © Quesito Hosting
