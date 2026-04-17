// =========================================================
// INDEX — Punto de entrada del servidor Fastify
// Registra plugins, rutas y arranca en el puerto definido
// =========================================================

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import type { FastifyRequest, FastifyReply } from 'fastify'

import dbPlugin    from './plugins/db'
import authRoutes  from './routes/auth'
import metricsRoutes from './routes/metrics'

// Crea la instancia de Fastify con logs habilitados
const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',   // Logs con colores en desarrollo
      options: { colorize: true },
    },
  },
})

async function bootstrap() {

  // ── Plugins globales ──────────────────────────────────

  // CORS — permite requests desde el frontend
  await fastify.register(cors, {
    origin:      process.env.NODE_ENV === 'production'
      ? ['https://completohosting.lat']   // Solo el dominio en producción
      : true,                              // Cualquier origen en desarrollo
    credentials: true,
  })

  // JWT — manejo de tokens de autenticación
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-cambiar',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  })

  // WebSocket — para el stream de métricas en tiempo real
  await fastify.register(websocket)

  // Base de datos PostgreSQL
  await fastify.register(dbPlugin)

  // ── Decorador de autenticación ────────────────────────
  // Middleware reutilizable que verifica el JWT en rutas protegidas
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
      } catch {
        reply.status(401).send({
          error:   'unauthorized',
          message: 'Token inválido o expirado',
        })
      }
    }
  )

  // ── Rutas ─────────────────────────────────────────────
  await fastify.register(authRoutes)
  await fastify.register(metricsRoutes)

  // ── Health check — para verificar que el server corre ─
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  // ── Arrancar el servidor ───────────────────────────────
  const port = parseInt(process.env.PORT || '3001')
  const host = process.env.HOST || '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    fastify.log.info(`🚀 Backend corriendo en http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

bootstrap()