// =========================================================
// INDEX — Punto de entrada del servidor Fastify
// =========================================================

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import type { FastifyRequest, FastifyReply } from "fastify";

import dbPlugin from "./plugins/db";
import authRoutes from "./routes/auth";
import metricsRoutes from "./routes/metrics";
import processesRoutes from "./routes/processes";
import settingsRoutes from "./routes/settings";
import { MinecraftManager } from "./minecraft/MinecraftManager";
import minecraftRoutes from "./routes/minecraft";

const fastify = Fastify({
  ignoreTrailingSlash: true,
  logger: {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  },
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    minecraft: MinecraftManager;
  }
}

async function bootstrap() {
  await fastify.register(cors, {
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://completohosting.lat"]
        : true,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "fallback-secret-cambiar",
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
  });

  await fastify.register(websocket);

  await fastify.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 1024,
    },
  });

  await fastify.register(dbPlugin);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({
          error: "unauthorized",
          message: "Token inválido o expirado",
        });
      }
    },
  );

  const minecraft = new MinecraftManager(fastify.db);
  await minecraft.init();
  fastify.decorate("minecraft", minecraft);
  fastify.log.info("✅ MinecraftManager inicializado");

  await fastify.register(authRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(processesRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(minecraftRoutes);

  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  const shutdown = async (signal: string) => {
    fastify.log.info(`${signal} recibido — cerrando servidor...`);
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const port = parseInt(process.env.PORT || "3001");
  const host = process.env.HOST || "0.0.0.0";

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 Backend corriendo en http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();