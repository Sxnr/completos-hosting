// =========================================================
// DB PLUGIN — Conexión a PostgreSQL con pg Pool
// Pool mantiene múltiples conexiones reutilizables
// =========================================================

import fp from 'fastify-plugin'
import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'

// Declaración del pool para que TypeScript lo reconozca en fastify
declare module 'fastify' {
  interface FastifyInstance {
    db: Pool
  }
}

// Construye la config del pool a partir de DATABASE_URL (prioritario)
// o de las variables individuales como fallback.
export function getPoolConfig() {
  const url = process.env.DATABASE_URL
  if (url) {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: u.pathname.replace(/^\//, ''),
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
      max: 10,
      idleTimeoutMillis: 30000,
    }
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'completos_hosting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
  }
}

export const db = new Pool(getPoolConfig())

async function dbPlugin(fastify: FastifyInstance) {
  // Crea el pool de conexiones con las variables de entorno
  const pool = new Pool(getPoolConfig())

  // Verifica que la conexión funcione al arrancar
  try {
    const client = await pool.connect()
    fastify.log.info('✅ PostgreSQL conectado correctamente')
    client.release()
  } catch (err) {
    fastify.log.error('❌ Error conectando a PostgreSQL:')
    // No bloqueamos el arranque — el backend puede funcionar sin DB
    // para las métricas del sistema
  }

  // Expone el pool en la instancia de fastify
  fastify.decorate('db', pool)

  // Cierra el pool limpiamente cuando el servidor se apaga
  fastify.addHook('onClose', async () => {
    await pool.end()
    fastify.log.info('Pool de PostgreSQL cerrado')
  })
}

// fastify-plugin evita el encapsulamiento y expone el plugin globalmente
export default fp(dbPlugin)