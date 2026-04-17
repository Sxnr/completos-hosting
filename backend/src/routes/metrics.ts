// =========================================================
// METRICS ROUTE — Endpoint REST + WebSocket de métricas
// GET  /api/metrics        → Snapshot actual del sistema
// WS   /api/metrics/live   → Stream en tiempo real
// =========================================================

import type { FastifyInstance } from "fastify";
import { getSystemMetrics, getDiskUsage } from "../services/system";

export default async function metricsRoutes(fastify: FastifyInstance) {
  // ── GET /api/metrics — snapshot único ──────────────────
  fastify.get("/api/metrics", async (request, reply) => {
    try {
      const [system, disk] = await Promise.all([
        getSystemMetrics(),
        getDiskUsage(),
      ]);

      return { ...system, disk };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({
        error: "metrics_error",
        message: "Error al obtener métricas del sistema",
      });
    }
  });

  // ── WS /api/metrics/live — stream cada 2 segundos ──────
  fastify.get("/api/metrics/live", { websocket: true }, (connection) => {
    fastify.log.info("Cliente WebSocket conectado");

    // El socket real vive en connection.socket
    const ws = connection.socket;

    // Envía métricas inmediatamente al conectar
    const sendMetrics = async () => {
      try {
        const [system, disk] = await Promise.all([
          getSystemMetrics(),
          getDiskUsage(),
        ]);
        // readyState 1 = OPEN — verifica que el cliente sigue conectado
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ ...system, disk }));
        }
      } catch (err) {
        fastify.log.error({ err }, "Error enviando métricas WS");
      }
    };

    sendMetrics();

    // Intervalo de actualización cada 2 segundos
    const interval = setInterval(sendMetrics, 2000);

    // Limpia el intervalo cuando el cliente se desconecta
    ws.on("close", () => {
      clearInterval(interval);
      fastify.log.info("Cliente WebSocket desconectado");
    });
  });
}
