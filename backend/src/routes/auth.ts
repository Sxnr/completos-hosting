// =========================================================
// AUTH ROUTE — Login y generación de JWT
// POST /api/auth/login   → Devuelve token JWT
// GET  /api/auth/me      → Verifica token y devuelve usuario
// =========================================================

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'

export default async function authRoutes(fastify: FastifyInstance) {

  // ── POST /api/auth/login ────────────────────────────────
  fastify.post<{
    Body: { username: string; password: string }
  }>('/api/auth/login', async (request, reply) => {

    const { username, password } = request.body

    // Validación básica de que llegaron los campos
    if (!username || !password) {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Usuario y contraseña son requeridos',
      })
    }

    try {
      // Busca el usuario en la base de datos
      const result = await fastify.db.query(
        'SELECT * FROM users WHERE username = $1 LIMIT 1',
        [username]
      )

      const user = result.rows[0]

      // Si no existe el usuario — mismo mensaje que contraseña incorrecta
      // para no dar pistas de qué campo falló (seguridad)
      if (!user) {
        return reply.status(401).send({
          error: 'invalid_credentials',
          message: 'Usuario o contraseña incorrectos',
        })
      }

      // Compara la contraseña con el hash almacenado
      const validPassword = await bcrypt.compare(password, user.password)

      if (!validPassword) {
        return reply.status(401).send({
          error: 'invalid_credentials',
          message: 'Usuario o contraseña incorrectos',
        })
      }

      // Genera el JWT con el payload del usuario
      const token = fastify.jwt.sign({
        id:       user.id,
        username: user.username,
        role:     user.role,
      })

      // Actualiza la fecha del último login
      await fastify.db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      )

      return {
        token,
        user: {
          id:       user.id,
          username: user.username,
          role:     user.role,
        },
      }

    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({
        error: 'server_error',
        message: 'Error interno del servidor',
      })
    }
  })

  // ── GET /api/auth/me — verifica token activo ───────────
  fastify.get('/api/auth/me', {
    // Middleware que verifica el JWT automáticamente
    preHandler: [fastify.authenticate],
  }, async (request) => {
    // request.user viene del JWT decodificado
    return { user: request.user }
  })
}