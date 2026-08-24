// =========================================================
// WEB HOSTING ROUTES — API REST del módulo de Web Hosting
// =========================================================

import type { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'

export default async function webhostingRoutes(fastify: FastifyInstance) {
  // ── Listar ──────────────────────────────────────────────
  fastify.get('/api/web', { preHandler: [fastify.authenticate] }, async () => {
    return { sites: await fastify.web.listSites() }
  })

  // ── Crear (solo admin) ──────────────────────────────────
  fastify.post<{ Body: { name: string; phpEnabled?: boolean; phpVersion?: string; ssl?: boolean } }>(
    '/api/web', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const { name, phpEnabled, phpVersion, ssl } = request.body
      if (!name) return reply.status(400).send({ error: 'missing_name' })
      try {
        const site = await fastify.web.createSite({
          name, phpEnabled: phpEnabled ?? request.body.phpEnabled ?? false,
          phpVersion, ssl, createdBy: (request.user as any).id,
        })
        return { success: true, site }
      } catch (err: any) { return reply.status(500).send({ error: 'create_error', message: err.message }) }
    })

  // ── Detalle ─────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/web/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
    const site = await fastify.web.getSite(id)
    if (!site) return reply.status(404).send({ error: 'not_found' })
    return site
  })

  // ── Eliminar (solo admin) ───────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/web/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { role: string }
    if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
    try { await fastify.web.deleteSite(id); return { success: true } }
    catch (err: any) { return reply.status(500).send({ error: 'delete_error', message: err.message }) }
  })

  // ── Start / Stop ────────────────────────────────────────
  for (const [verb, method] of [['start', 'startSite'], ['stop', 'stopSite']] as const) {
    fastify.post<{ Params: { id: string } }>(
      `/api/web/:id/${verb}`, { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const id = parseInt(request.params.id)
        if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
        try { await (fastify.web as any)[method](id); return { success: true } }
        catch (err: any) { return reply.status(500).send({ error: `${verb}_error`, message: err.message }) }
      })
  }

  // ── File manager ────────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { dir?: string } }>(
    '/api/web/:id/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return { path: request.query.dir || '/', files: fastify.web.listFiles(id, request.query.dir || '') } }
      catch (err: any) { return reply.status(400).send({ error: 'list_error', message: err.message }) }
    })

  fastify.get<{ Params: { id: string }; Querystring: { path: string } }>(
    '/api/web/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return { path: request.query.path, content: fastify.web.readFile(id, request.query.path) } }
      catch (err: any) { return reply.status(400).send({ error: 'read_error', message: err.message }) }
    })

  fastify.put<{ Params: { id: string }; Body: { path: string; content: string } }>(
    '/api/web/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.web.writeFile(id, request.body.path, request.body.content); return { success: true } }
      catch (err: any) { return reply.status(400).send({ error: 'write_error', message: err.message }) }
    })

  fastify.delete<{ Params: { id: string }; Querystring: { path: string } }>(
    '/api/web/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.web.deletePath(id, request.query.path); return { success: true } }
      catch (err: any) { return reply.status(400).send({ error: 'delete_error', message: err.message }) }
    })

  fastify.post<{ Params: { id: string } }>(
    '/api/web/:id/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'admin') return reply.status(403).send({ error: 'forbidden' })
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'missing_file' })
      const rel = ((data.fields as any)?.path?.value as string) || data.filename
      try {
        const chunks: Buffer[] = []
        for await (const c of data.file) chunks.push(c as Buffer)
        fastify.web.uploadFile(id, rel, Buffer.concat(chunks))
        return { success: true, path: rel }
      } catch (err: any) { return reply.status(400).send({ error: 'upload_error', message: err.message }) }
    })
}
