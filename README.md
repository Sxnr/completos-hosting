# Completos Hosting — Dashboard

Panel de administración y monitoreo profesional para servidor Debian 12.

## Estructura del proyecto

- `frontend/` — React + Vite + TypeScript
- `backend/` — Node.js + Fastify + TypeScript

## Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Node.js + Fastify + TypeScript
- **Base de datos**: PostgreSQL
- **Proceso**: PM2
- **Proxy**: Nginx
- **Servidor**: Debian 12

## Flujo de deploy

1. Desarrollar en local (Windows 11 + VSCode)
2. Push a GitHub
3. Pull desde Debian 12
4. PM2 reinicia los servicios automáticamente