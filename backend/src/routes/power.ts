// =========================================================
// POWER ROUTES — Control remoto de energía del servidor
// GET  /api/power      → Estado de la configuración
// POST /api/power/on   → Envía señal de encendido (WoL)
// POST /api/power/off  → Apaga el servidor (comando del SO)
// Solo rol admin.
// =========================================================

import type { FastifyInstance } from 'fastify'
import { getPowerStatus, powerOn, powerOff } from '../services/power'

export default async function powerRoutes(fastify: FastifyInstance) {
  // ── Estado ──────────────────────────────────────────────
  fastify.get('/api/power', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { role: string; username: string }
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'forbidden' })
    }
    return getPowerStatus()
  })

  // ── Encender ────────────────────────────────────────────
  fastify.post('/api/power/on', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { role: string; username: string }
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'forbidden' })
    }
    try {
      const message = await powerOn()
      fastify.log.info(`Encendido solicitado por ${user.username}`)
      return { success: true, message }
    } catch (err: any) {
      return reply.status(500).send({ error: 'power_on_error', message: err.message })
    }
  })

  // ── Apagar ──────────────────────────────────────────────
  fastify.post('/api/power/off', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as { role: string; username: string }
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'forbidden' })
    }
    try {
      const message = await powerOff()
      fastify.log.warn(`Apagado solicitado por ${user.username}`)
      return { success: true, message }
    } catch (err: any) {
      return reply.status(500).send({ error: 'power_off_error', message: err.message })
    }
  })
}
