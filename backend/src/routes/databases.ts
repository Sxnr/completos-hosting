// =========================================================
// DATABASES ROUTES — API REST del módulo de Bases de Datos
// =========================================================

import type { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'

export default async function databasesRoutes(fastify: FastifyInstance) {
  // ── Listar ──────────────────────────────────────────────
  fastify.get('/api/databases', { preHandler: [fastify.authenticate] }, async () => {
    return { instances: await fastify.databases.listInstances() }
  })

  // ── Crear (solo admin) ──────────────────────────────────
  fastify.post<{ Body: { name: string; engine: string; version: string } }>(
    '/api/databases', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const { name, engine, version } = request.body
      if (!name || !engine || !version) {
        return reply.status(400).send({ error: 'missing_fields', message: 'name, engine y version son requeridos' })
      }
      if (!['postgresql', 'mariadb', 'mysql'].includes(engine)) {
        return reply.status(400).send({ error: 'invalid_engine' })
      }
      try {
        const inst = await fastify.databases.createInstance({
          name, engine: engine as any, version, createdBy: (request.user as any).id,
        })
        return { success: true, instance: inst }
      } catch (err: any) {
        return reply.status(500).send({ error: 'create_error', message: err.message })
      }
    })

  // ── Detalle ─────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/databases/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
    const row = await fastify.databases.getRow(id)
    if (!row) return reply.status(404).send({ error: 'not_found' })
    let status = 'offline'
    try { status = fastify.databases.getInstance(id).status } catch {}
    return { ...row, status }
  })

  // ── Eliminar (solo admin) ───────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/databases/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { role: string }
    if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
    try { await fastify.databases.deleteInstance(id); return { success: true } }
    catch (err: any) { return reply.status(500).send({ error: 'delete_error', message: err.message }) }
  })

  // ── Start / Stop / Restart ──────────────────────────────
  for (const [verb, method] of [['start', 'startInstance'], ['stop', 'stopInstance'], ['restart', 'restartInstance']] as const) {
    fastify.post<{ Params: { id: string } }>(
      `/api/databases/:id/${verb}`, { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const id = parseInt(request.params.id)
        if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
        try { await (fastify.databases as any)[method](id); return { success: true } }
        catch (err: any) { return reply.status(500).send({ error: `${verb}_error`, message: err.message }) }
      })
  }

  // ── Backup ──────────────────────────────────────────────
  fastify.post<{ Params: { id: string }; Body: { fileName?: string } }>(
    '/api/databases/:id/backup', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const fileName = request.body.fileName || `backup-${Date.now()}.sql`
      try {
        const path = await fastify.databases.backup(id, fileName)
        return { success: true, path }
      } catch (err: any) { return reply.status(500).send({ error: 'backup_error', message: err.message }) }
    })

  // ── Restore (subir dump) ────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/databases/:id/restore', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'missing_file' })
      const tmp = `/tmp/restore-${id}-${Date.now()}.sql`
      await pipeline(data.file, fs.createWriteStream(tmp))
      try { await fastify.databases.restore(id, tmp); return { success: true } }
      catch (err: any) { return reply.status(500).send({ error: 'restore_error', message: err.message }) }
      finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) }
    })

  // ── Reset password ──────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/databases/:id/password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { const pw = await fastify.databases.resetPassword(id); return { success: true, newPassword: pw } }
      catch (err: any) { return reply.status(500).send({ error: 'password_error', message: err.message }) }
    })
}
