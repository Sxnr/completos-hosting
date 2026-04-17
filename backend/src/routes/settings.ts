// =========================================================
// SETTINGS ROUTE — Configuración del sistema
// GET    /api/settings/me          → Perfil del usuario actual
// PUT    /api/settings/password    → Cambiar contraseña
// GET    /api/settings/users       → Listar usuarios (solo admin)
// POST   /api/settings/users       → Crear usuario  (solo admin)
// DELETE /api/settings/users/:id   → Eliminar usuario (solo admin)
// =========================================================

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
// ← Sin import de db

export default async function settingsRoutes(fastify: FastifyInstance) {

  fastify.get('/api/settings/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { id: number; username: string; role: string }
    const row = await fastify.db.query(
      'SELECT id, username, role, created_at FROM users WHERE id = $1',
      [user.id]
    )
    if (!row.rows[0]) return reply.status(404).send({ error: 'not_found' })
    return row.rows[0]
  })

  fastify.put<{
    Body: { currentPassword: string; newPassword: string }
  }>('/api/settings/password', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body
    const user = request.user as { id: number }

    if (!currentPassword || !newPassword)
      return reply.status(400).send({ error: 'missing_fields' })

    if (newPassword.length < 8)
      return reply.status(400).send({
        error: 'weak_password',
        message: 'La contraseña debe tener al menos 8 caracteres',
      })

    const row = await fastify.db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    )
    const valid = await bcrypt.compare(currentPassword, row.rows[0]?.password_hash || '')
    if (!valid)
      return reply.status(401).send({
        error: 'wrong_password',
        message: 'La contraseña actual es incorrecta',
      })

    const hash = await bcrypt.hash(newPassword, 12)
    await fastify.db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, user.id]
    )

    return { success: true, message: 'Contraseña actualizada correctamente' }
  })

  fastify.get('/api/settings/users', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { role: string }
    if (user.role !== 'admin')
      return reply.status(403).send({ error: 'forbidden', message: 'Solo admins' })

    const rows = await fastify.db.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    )
    return { users: rows.rows }
  })

  fastify.post<{
    Body: { username: string; password: string; role: 'admin' | 'viewer' }
  }>('/api/settings/users', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { role: string }
    if (user.role !== 'admin')
      return reply.status(403).send({ error: 'forbidden' })

    const { username, password, role } = request.body

    if (!username || !password)
      return reply.status(400).send({ error: 'missing_fields', message: 'Usuario y contraseña son requeridos' })

    if (password.length < 8)
      return reply.status(400).send({ error: 'weak_password', message: 'Contraseña mínima: 8 caracteres' })

    if (!['admin', 'viewer'].includes(role))
      return reply.status(400).send({ error: 'invalid_role' })

    const exists = await fastify.db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    )
    if (exists.rows[0])
      return reply.status(409).send({ error: 'user_exists', message: `El usuario '${username}' ya existe` })

    const hash = await bcrypt.hash(password, 12)
    const result = await fastify.db.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, hash, role]
    )

    return { success: true, user: result.rows[0] }
  })

  fastify.delete<{
    Params: { id: string }
  }>('/api/settings/users/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const reqUser = request.user as { id: number; role: string }
    const targetId = parseInt(request.params.id)

    if (reqUser.role !== 'admin')
      return reply.status(403).send({ error: 'forbidden' })

    if (reqUser.id === targetId)
      return reply.status(400).send({ error: 'self_delete', message: 'No puedes eliminarte a ti mismo' })

    const result = await fastify.db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [targetId]
    )

    if (!result.rows[0])
      return reply.status(404).send({ error: 'not_found' })

    return { success: true }
  })
}