// =========================================================
// BOTS ROUTES — API REST + WebSocket del módulo de Bots
// =========================================================

import type { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'

export default async function botsRoutes(fastify: FastifyInstance) {
  // ── Listar ──────────────────────────────────────────
  fastify.get('/api/bots', { preHandler: [fastify.authenticate] }, async () => {
    return { bots: fastify.bots.listBots() }
  })

  // ── Crear (solo admin) ───────────────────────────────
  fastify.post<{
    Body: {
      name: string
      source: 'upload' | 'git'
      repo?: string
      runCommand?: string
      env?: Record<string, string>
      autostart?: boolean
    }
  }>('/api/bots', { preHandler: [fastify.authenticate] }, async (request, reply) => {

    const { name, source, repo, runCommand, env, autostart } = request.body
    if (!name || !source) return reply.status(400).send({ error: 'missing_fields' })
    if (source === 'git' && !repo)
      return reply.status(400).send({ error: 'missing_repo' })
    try {
      const bot = await fastify.bots.createBot({ name, source, repo, runCommand, env, autostart })
      return { success: true, bot }
    } catch (err: any) {
      request.log.error({ err }, 'Error creando bot')
      return reply.status(500).send({ error: 'create_error', message: err.message })
    }
  })

  // ── Detalle ──────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/bots/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const bot = fastify.bots.getMeta(id)
      if (!bot) return reply.status(404).send({ error: 'not_found' })
      const rt = fastify.bots.getRuntime(id)
      return {
        ...bot,
        status: rt?.status ?? 'offline',
        startedAt: rt?.startedAt ?? null,
        pid: rt?.proc?.pid ?? null,
      }
    })

  // ── Eliminar (solo admin) ───────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/api/bots/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { await fastify.bots.deleteBot(id); return { success: true } }
      catch (err: any) { return reply.status(500).send({ error: 'delete_error', message: err.message }) }
    })

  // ── Start / Stop / Restart ───────────────────────────
  for (const [verb, method] of [['start', 'startBot'], ['stop', 'stopBot'], ['restart', 'restartBot']] as const) {
    fastify.post<{ Params: { id: string } }>(
      `/api/bots/:id/${verb}`, { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const id = parseInt(request.params.id)
        if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
        try { (fastify.bots as any)[method](id); return { success: true, message: `Bot ${verb}` } }
        catch (err: any) { return reply.status(500).send({ error: `${verb}_error`, message: err.message }) }
      })
  }

  // ── git pull (solo git) ──────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/bots/:id/pull', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.bots.pullRepo(id); return { success: true, message: 'git pull ejecutado' } }
      catch (err: any) { return reply.status(500).send({ error: 'pull_error', message: err.message }) }
    })

  // ── Leer contenido crudo del .env ────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/bots/:id/env', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return { content: fastify.bots.getEnvRaw(id) } }
      catch (err: any) { return reply.status(500).send({ error: 'env_error', message: err.message }) }
    })

  // ── Guardar .env (editor crudo) ──────────────────────
  fastify.put<{ Params: { id: string }; Body: { content: string } }>(
    '/api/bots/:id/env', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.bots.updateEnv(id, request.body.content || ''); return { success: true } }
      catch (err: any) { return reply.status(500).send({ error: 'env_error', message: err.message }) }
    })

  // ── Enviar comando a la consola ──────────────────────
  fastify.post<{ Params: { id: string }; Body: { command: string } }>(
    '/api/bots/:id/command', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const { command } = request.body
      if (!command?.trim()) return reply.status(400).send({ error: 'missing_command' })
      try { fastify.bots.sendCommand(id, command.trim()); return { success: true } }
      catch (err: any) { return reply.status(500).send({ error: 'command_error', message: err.message }) }
    })

  // ── Limpiar consola ───────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/bots/:id/console/clear', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.bots.clearConsole(id); return { success: true } }
      catch (err: any) { return reply.status(500).send({ error: 'clear_error', message: err.message }) }
    })

  // ── Historial de consola ─────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/bots/:id/console', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return { lines: fastify.bots.getConsole(id) } }
      catch { return { lines: [] } }
    })

  // ── WebSocket de consola en vivo ─────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/api/bots/:id/console/ws', { websocket: true }, (socket, request) => {
      const ws = socket.socket
      const token = (request.query as { token?: string }).token
      const id = parseInt(request.params.id)

      if (!token) { ws.send(JSON.stringify({ type: 'error', message: 'No autorizado' })); ws.close(); return }
      try { fastify.jwt.verify(token) } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Token inválido' })); ws.close(); return
      }
      if (isNaN(id)) { ws.send(JSON.stringify({ type: 'error', message: 'ID inválido' })); ws.close(); return }

      const rt = fastify.bots.getRuntime(id)
      if (!rt) { ws.close(); return }

      if (rt.consoleLog.length > 0) ws.send(JSON.stringify({ type: 'history', lines: rt.consoleLog }))
      ws.send(JSON.stringify({ type: 'status', status: rt.status }))

      const onConsole = (line: unknown) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'console', line }))
      }
      const onStatus = (status: string) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'status', status }))
      }

      rt.on('console', onConsole)
      rt.on('status', onStatus)

      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'command' && msg.command?.trim()) fastify.bots.sendCommand(id, msg.command.trim())
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
        } catch {}
      })

      const cleanup = () => { rt.off('console', onConsole); rt.off('status', onStatus) }
      socket.on('close', cleanup)
      socket.on('error', cleanup)
    })

  // ── File manager ─────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { dir?: string } }>(
    '/api/bots/:id/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return fastify.bots.listFiles(id, request.query.dir || '') }
      catch (err: any) { return reply.status(400).send({ error: 'list_error', message: err.message }) }
    })

  fastify.get<{ Params: { id: string }; Querystring: { path: string } }>(
    '/api/bots/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { return fastify.bots.readFile(id, request.query.path) }
      catch (err: any) { return reply.status(400).send({ error: 'read_error', message: err.message }) }
    })

  fastify.put<{ Params: { id: string }; Body: { path: string; content: string } }>(
    '/api/bots/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.bots.writeFile(id, request.body.path, request.body.content); return { success: true } }
      catch (err: any) { return reply.status(400).send({ error: 'write_error', message: err.message }) }
    })

  fastify.delete<{ Params: { id: string }; Querystring: { path: string } }>(
    '/api/bots/:id/file', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      try { fastify.bots.deletePath(id, request.query.path); return { success: true } }
      catch (err: any) { return reply.status(400).send({ error: 'delete_error', message: err.message }) }
    })

  fastify.post<{ Params: { id: string } }>(
    '/api/bots/:id/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const id = parseInt(request.params.id)
      if (isNaN(id)) return reply.status(400).send({ error: 'invalid_id' })
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'missing_file' })
      const rel = ((data.fields as any)?.path?.value as string) || data.filename
      try {
        const chunks: Buffer[] = []
        for await (const c of data.file) chunks.push(c as Buffer)
        const saved = fastify.bots.uploadFile(id, rel, Buffer.concat(chunks))
        return { success: true, path: saved }
      } catch (err: any) { return reply.status(400).send({ error: 'upload_error', message: err.message }) }
    })
}
