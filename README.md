<div align="center">

# 🖥️ Completos Hosting
### Plataforma de Orquestación de Infraestructura Privada

[![Node.js](https://img.shields.io/badge/Node.js-v24-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![Debian](https://img.shields.io/badge/Debian-12_Bookworm-A81D33?style=flat-square&logo=debian)](https://debian.org)

*Una plataforma modular de gestión de infraestructura tipo mini-AWS, desplegada en servidor Debian 12 con arquitectura de microservicios.*

</div>

---

## 📋 Descripción

**Completos Hosting** es una plataforma web de administración de infraestructura privada construida con arquitectura de microservicios. Permite gestionar servidores de Minecraft, bases de datos, contenedores Docker y recursos del sistema desde un único dashboard accesible en red local.

Diseñada para escalar hacia módulos independientes de Hosting Web, Bases de Datos y Gaming, siguiendo principios de **Clean Architecture** y **Domain-Driven Design**.

---

## 🏗️ Arquitectura

```
completos-hosting/
├── apps/
│   └── dashboard/          # Frontend React + TypeScript + Vite
├── services/
│   ├── orchestrator/       # Gateway API - Punto de entrada único (Puerto 4000)
│   ├── docker-manager/     # Gestión de contenedores Docker (Puerto 4001)
│   └── auth-service/       # Autenticación JWT + PostgreSQL (Puerto 4002)
├── shared/                 # Tipos y utilidades compartidas
└── docker-compose.yml      # PostgreSQL + Redis
```

### Flujo de comunicación

```
Browser → Nginx (80) → Gateway (4000) → docker-manager (4001)
                                      → auth-service   (4002) → PostgreSQL (5432)
                                                               → Redis      (6379)
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Frontend | React + TypeScript + Vite | Dashboard de administración |
| Gateway | Node.js + Express + TypeScript | Punto de entrada y proxy |
| Auth | Node.js + JWT + bcryptjs | Autenticación y usuarios |
| Docker Manager | Node.js + Dockerode | Gestión de contenedores |
| Base de Datos | PostgreSQL 15 | Usuarios y registros |
| Cache/Eventos | Redis Alpine | Eventos en tiempo real |
| Reverse Proxy | Nginx 1.22 | Servir frontend y proxy API |
| Proceso Manager | PM2 | Gestión de procesos Node.js |
| Servidor | Debian GNU/Linux 12 (Bookworm) | 31 GB RAM |

---

## 🚀 Instalación y Despliegue

### Prerrequisitos

- Node.js v20+ (LTS)
- Docker + Docker Compose
- Git

### Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Sxnr/completos-hosting.git
cd completos-hosting

# 2. Levantar infraestructura (PostgreSQL + Redis)
docker compose up -d

# 3. Crear /services/auth-service/.env con las variables indicadas abajo

# 4. Instalar dependencias
cd services/orchestrator && npm install
cd ../docker-manager && npm install
cd ../auth-service && npm install
cd ../../apps/dashboard && npm install

# 5. Levantar servicios (una terminal por servicio)
npm run dev
```

Accede al dashboard en: `http://localhost:5173`

### Variables de entorno (`services/auth-service/.env`)

```env
PORT=4002
JWT_SECRET=completos_hosting_super_secreto_2026
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=123
DB_NAME=completos_db
```

### Despliegue en Producción (Debian 12)

```bash
# Instalar Docker
sudo apt install -y ca-certificates curl
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo apt update && sudo apt install -y docker-ce docker-compose-plugin

# Instalar Node.js vía NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc && nvm install --lts

# Clonar y configurar
git clone https://github.com/Sxnr/completos-hosting.git
cd completos-hosting
docker compose up -d

# Instalar PM2 y levantar servicios
sudo npm install -g pm2
pm2 start services/orchestrator/src/index.ts --name gateway --interpreter $(which tsx)
pm2 start services/docker-manager/src/index.ts --name docker-manager --interpreter $(which tsx)
pm2 start services/auth-service/src/index.ts --name auth-service --interpreter $(which tsx)
pm2 save && pm2 startup

# Build y deploy del frontend
cd apps/dashboard && npm run build
sudo cp -r dist/* /var/www/completos-hosting/
```

---

## 🔌 API Endpoints

### Gateway (Puerto 4000)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/status` | Estado del gateway y servicios |
| POST | `/auth/register` | Registrar usuario |
| POST | `/auth/login` | Login y obtener JWT |
| GET | `/docker/containers` | Listar contenedores |
| GET | `/docker/info` | Info del sistema Docker |

---

## 🗺️ Roadmap

### ✅ v0.1 — Base (Completado)
- [x] Arquitectura de microservicios con Gateway
- [x] Autenticación JWT con PostgreSQL
- [x] Docker Manager con Dockerode
- [x] Dashboard básico con React + Vite
- [x] Despliegue en Debian 12 con PM2 + Nginx

### 🔄 v0.2 — Seguridad y UX (Próximo)
- [ ] Pantalla de Login en el dashboard
- [ ] Rutas protegidas con JWT en el frontend
- [ ] Sidebar de navegación modular
- [ ] Tema visual mejorado (dark mode profesional)
- [ ] Manejo de errores global en el frontend

### 🎮 v0.3 — Módulo Minecraft
- [ ] Crear/iniciar/detener servidores de Minecraft como contenedores
- [ ] Selección de versión (Vanilla, Forge, Fabric, Paper)
- [ ] Upload de modpacks y mods (.jar)
- [ ] Consola en tiempo real con WebSockets
- [ ] Monitor de RAM y CPU por instancia

### 🗄️ v0.4 — Módulo Bases de Datos
- [ ] Crear instancias de PostgreSQL/MariaDB/MySQL
- [ ] Interfaz tipo phpMyAdmin integrada
- [ ] Backup y restore de bases de datos
- [ ] Gestión de usuarios por base de datos

### 🌐 v0.5 — Módulo Web Hosting
- [ ] Subida de archivos HTML/CSS/PHP via drag & drop
- [ ] Gestión de dominios/subdominios con Nginx
- [ ] Soporte PHP con contenedor dedicado
- [ ] Certificados SSL con Let's Encrypt

### 📊 v0.6 — Monitoreo Avanzado
- [ ] Gráficos en tiempo real (CPU, RAM, Red, Disco)
- [ ] Alertas por uso excesivo de recursos
- [ ] Historial de métricas con retención configurable
- [ ] Integración con Prometheus + Grafana

### 🔧 v1.0 — Plataforma Completa
- [ ] Sistema de roles y permisos (admin, user, viewer)
- [ ] Auto-deploy desde GitHub via webhooks
- [ ] API pública documentada con Swagger
- [ ] CLI para gestión desde terminal

---

## 👥 Equipo

| Nombre | Rol |
|--------|-----|
| Francisco Carrera | Arquitecto & Lead Developer |

---

## 📄 Licencia

MIT License — libre para uso personal y educativo.
