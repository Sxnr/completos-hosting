// =========================================================
// PROCESSES ROUTE — Endpoints de procesos y servicios
// GET /api/processes         → Top procesos por CPU
// GET /api/services          → Estado de servicios del sistema
// POST /api/services/restart → Reinicia un servicio
// =========================================================

import type { FastifyInstance } from 'fastify'
import { getTopProcesses, getServiceStatus } from '../services/processes'
import { execSync } from 'child_process'

export default async function processesRoutes(fastify: FastifyInstance) {

  // ── GET /api/processes — top procesos por CPU ───────────
  fastify.get('/api/processes', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const processes = getTopProcesses(20)
      return { processes, timestamp: Date.now() }
    } catch (err) {
      fastify.log.error({ err }, 'Error obteniendo procesos')
      return reply.status(500).send({ error: 'process_error', message: 'Error leyendo procesos' })
    }
  })

  // ── GET /api/services — estado de servicios ─────────────
  fastify.get('/api/services', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const services = getServiceStatus()
      return { services, timestamp: Date.now() }
    } catch (err) {
      fastify.log.error({ err }, 'Error obteniendo servicios')
      return reply.status(500).send({ error: 'service_error', message: 'Error leyendo servicios' })
    }
  })

  // ── POST /api/services/restart — reinicia un servicio ───
  fastify.post<{
    Body: { service: string }
  }>('/api/services/restart', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { service } = request.body

    // Whitelist de servicios permitidos — seguridad crítica
    // Solo se puede reiniciar lo que está en esta lista
    const ALLOWED = ['nginx', 'postgresql', 'ssh', 'fail2ban']

    if (!ALLOWED.includes(service)) {
      return reply.status(403).send({
        error: 'forbidden',
        message: `Servicio '${service}' no está permitido reiniciar`,
      })
    }

    try {
      execSync(`systemctl restart ${service}`, { timeout: 15000 })
      fastify.log.info(`Servicio ${service} reiniciado por usuario ${(request.user as any).username}`)
      return { success: true, message: `${service} reiniciado correctamente` }
    } catch (err) {
      fastify.log.error({ err }, `Error reiniciando ${service}`)
      return reply.status(500).send({
        error: 'restart_error',
        message: `Error al reiniciar ${service}`,
      })
    }
  })
}