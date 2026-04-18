# 🖥️ Completo Hosting Dashboard

Panel de administración self-hosted para gestionar servidores, instancias de Minecraft, bases de datos y más — todo desde una interfaz web moderna.

**URL de producción:** [completohosting.lat](https://completohosting.lat)

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

### 🔄 v0.4 — Módulo Bases de Datos *(próximo)*
- [ ] Crear instancias de PostgreSQL / MariaDB / MySQL
- [ ] Interfaz tipo phpMyAdmin integrada
- [ ] Backup y restore de bases de datos
- [ ] Gestión de usuarios por base de datos

### 🔄 v0.5 — Módulo Web Hosting *(próximo)*
- [ ] Subida de archivos HTML/CSS/PHP via drag & drop
- [ ] Gestión de dominios/subdominios con Nginx
- [ ] Soporte PHP con contenedor dedicado
- [ ] Certificados SSL con Let's Encrypt

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
│   │   ├── config/           # Configuración (DB, Minecraft, etc.)
│   │   ├── hooks/            # Hooks de autenticación Fastify
│   │   ├── minecraft/        # MinecraftManager + MinecraftInstance
│   │   ├── routes/           # Rutas de la API REST
│   │   └── server.ts         # Entry point
│   ├── .env                  # Variables de entorno (no commitear)
│   └── package.json
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   ├── hooks/            # Custom hooks (useMinecraftConsole, etc.)
│   │   ├── layouts/          # DashboardLayout
│   │   ├── pages/            # Páginas principales
│   │   ├── services/         # api.ts (Axios)
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
```

```bash
# frontend/.env
nano frontend/.env
```

```env
VITE_API_URL=https://completohosting.lat
VITE_WS_URL=wss://completohosting.lat
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
sudo cp nginx.conf /etc/nginx/sites-available/completohosting
sudo ln -s /etc/nginx/sites-available/completohosting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Cloudflare

En el panel de Cloudflare:
- Apunta el dominio `completohosting.lat` a la IP de tu servidor Debian
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
