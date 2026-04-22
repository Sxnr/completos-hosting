// =========================================================
// MINECRAFT ROUTES — API REST completa del módulo
// =========================================================

import type { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { MC_CONFIG } from "../config/minecraft";

export default async function minecraftRoutes(fastify: FastifyInstance) {
  // ── GET /api/minecraft — listar instancias ────────────
  fastify.get(
    "/api/minecraft",
    {
      preHandler: [fastify.authenticate],
    },
    async () => {
      const instances = await fastify.minecraft.listInstances();
      return { instances };
    },
  );

  // ── POST /api/minecraft — crear instancia ─────────────
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      software: string;
      version: string;
      edition: string;
      port?: number;
      ramMb?: number;
    };
  }>(
    "/api/minecraft",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as { id: number; role: string };

      if (user.role !== "admin")
        return reply.status(403).send({ error: "forbidden" });

      const { name, description, software, version, edition } = request.body;
      const port = request.body.port
        ? parseInt(String(request.body.port)) || undefined
        : undefined;
      const ramMb = request.body.ramMb
        ? parseInt(String(request.body.ramMb)) || 1024
        : 1024;

      if (!name || !software || !version || !edition)
        return reply.status(400).send({
          error: "missing_fields",
          message: "name, software, version y edition son requeridos",
        });

      try {
        const instance = await fastify.minecraft.createInstance({
          name,
          description,
          software,
          version,
          edition,
          port,
          ramMb: ramMb || 1024,
          createdBy: user.id
            ? parseInt(String(user.id)) || undefined
            : undefined,
        });
        return { success: true, instance };
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "create_error", message: err.message });
      }
    },
  );

  // ── GET /api/minecraft/:id — detalle de instancia ─────
  fastify.get<{ Params: { id: string } }>(
    "/api/minecraft/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      const row = await fastify.minecraft.getInstance(id);
      if (!row) return reply.status(404).send({ error: "not_found" });

      let status = "offline";
      let playerCount = 0;
      let players: string[] = [];

      try {
        const mem = fastify.minecraft.getInstance_mem(id);
        status = mem.status;
        playerCount = mem.playerCount;
        players = mem.players;
      } catch {
        /* instancia no en memoria — es offline */
      }

      return { ...row, status, playerCount, players };
    },
  );

  // ── DELETE /api/minecraft/:id — eliminar instancia ────
  fastify.delete<{ Params: { id: string } }>(
    "/api/minecraft/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as { role: string };
      if (user.role !== "admin")
        return reply.status(403).send({ error: "forbidden" });

      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });

      try {
        await fastify.minecraft.deleteInstance(id);
        return { success: true };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "delete_error", message: err.message });
      }
    },
  );

  // ── POST /api/minecraft/:id/start ─────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/api/minecraft/:id/start",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      try {
        await fastify.minecraft.startInstance(id);
        return { success: true, message: "Servidor iniciando..." };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "start_error", message: err.message });
      }
    },
  );

  // ── POST /api/minecraft/:id/stop ──────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/api/minecraft/:id/stop",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      try {
        await fastify.minecraft.stopInstance(id);
        return { success: true, message: "Servidor deteniéndose..." };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "stop_error", message: err.message });
      }
    },
  );

  // ── POST /api/minecraft/:id/restart ───────────────────
  fastify.post<{ Params: { id: string } }>(
    "/api/minecraft/:id/restart",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      try {
        await fastify.minecraft.restartInstance(id);
        return { success: true, message: "Servidor reiniciando..." };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "restart_error", message: err.message });
      }
    },
  );

  // ── POST /api/minecraft/:id/command ───────────────────
  fastify.post<{
    Params: { id: string };
    Body: { command: string };
  }>(
    "/api/minecraft/:id/command",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      const { command } = request.body;

      if (!command?.trim())
        return reply.status(400).send({ error: "missing_command" });

      try {
        const instance = fastify.minecraft.getInstance_mem(id);
        if (!instance.isRunning)
          return reply.status(400).send({
            error: "not_running",
            message: "El servidor no está corriendo",
          });

        instance.sendCommand(command);
        return { success: true };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "command_error", message: err.message });
      }
    },
  );

  // ── GET /api/minecraft/:id/console — historial ────────
  fastify.get<{ Params: { id: string } }>(
    "/api/minecraft/:id/console",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      try {
        const instance = fastify.minecraft.getInstance_mem(id);
        return { lines: instance.consoleLog };
      } catch {
        return { lines: [] };
      }
    },
  );

  // ── PUT /api/minecraft/:id/config — server.properties ─
  fastify.put<{
    Params: { id: string };
    Body: {
      properties: Record<string, unknown>;
      ramMb?: number;
      javaFlags?: string;
    };
  }>(
    "/api/minecraft/:id/config",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as { role: string };
      if (user.role !== "admin")
        return reply.status(403).send({ error: "forbidden" });

      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      const { properties, ramMb, javaFlags } = request.body;

      const row = await fastify.minecraft.getInstance(id);
      if (!row) return reply.status(404).send({ error: "not_found" });

      await fastify.db.query(
        `UPDATE minecraft_instances
       SET properties = $1,
           ram_mb     = COALESCE($2, ram_mb),
           java_flags = COALESCE($3, java_flags)
       WHERE id = $4`,
        [JSON.stringify(properties), ramMb || null, javaFlags ?? null, id],
      );

      const instanceDir = path.join(MC_CONFIG.serversDir, row.folder_name);
      const lines = [
        "#Minecraft server properties",
        "#Edited via ServerOS Dashboard",
        "",
        ...Object.entries(properties).map(([k, v]) => `${k}=${v}`),
      ];
      fs.writeFileSync(
        path.join(instanceDir, "server.properties"),
        lines.join("\n"),
      );

      return {
        success: true,
        message:
          "Configuración guardada. Reinicia el servidor para aplicar cambios.",
      };
    },
  );

  // ── GET /api/minecraft/:id/files — explorador ─────────
  fastify.get<{
    Params: { id: string };
    Querystring: { dir?: string };
  }>(
    "/api/minecraft/:id/files",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      const row = await fastify.minecraft.getInstance(id);
      if (!row) return reply.status(404).send({ error: "not_found" });

      const baseDir = path.join(MC_CONFIG.serversDir, row.folder_name);
      const subDir = request.query.dir || "";
      const targetDir = path.resolve(baseDir, subDir);

      if (!targetDir.startsWith(baseDir))
        return reply
          .status(403)
          .send({ error: "forbidden", message: "Path no permitido" });

      if (!fs.existsSync(targetDir))
        return reply.status(404).send({ error: "dir_not_found" });

      const entries = fs.readdirSync(targetDir, { withFileTypes: true });

      const files = entries.map((entry) => ({
        name: entry.name,
        isDir: entry.isDirectory(),
        size: entry.isFile()
          ? fs.statSync(path.join(targetDir, entry.name)).size
          : null,
        modified: fs
          .statSync(path.join(targetDir, entry.name))
          .mtime.toISOString(),
      }));

      files.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { path: subDir || "/", files };
    },
  );

  // ── GET /api/minecraft/software/versions ──────────────
  fastify.get<{
    Querystring: { software: string };
  }>(
    "/api/minecraft/software/versions",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { software } = request.query;
      try {
        const versions = await _fetchVersions(software);
        return { versions };
      } catch (err: any) {
        return reply
          .status(500)
          .send({ error: "fetch_error", message: err.message });
      }
    },
  );

  // ── POST /api/minecraft/:id/download-jar ──────────────
  fastify.post<{
    Params: { id: string };
  }>(
    "/api/minecraft/:id/download-jar",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as { role: string };
      if (user.role !== "admin")
        return reply.status(403).send({ error: "forbidden" });

      const id = parseInt(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "invalid_id" });
      const row = await fastify.minecraft.getInstance(id);
      if (!row) return reply.status(404).send({ error: "not_found" });

      fastify.minecraft
        .downloadJar(row.software, row.version)
        .then(() =>
          fastify.log.info(`JAR ${row.software} ${row.version} descargado`),
        )
        .catch((err) =>
          fastify.log.error(`Error descargando JAR: ${err.message}`),
        );

      return {
        success: true,
        message: `Descargando ${row.software} ${row.version}...`,
      };
    },
  );

  // ── GET /api/minecraft/:id/download-progress — SSE ────
  fastify.get<{
    Params: { id: string };
    Querystring: { software: string; version: string };
  }>(
    "/api/minecraft/:id/download-progress",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { software, version } = request.query;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const send = (data: object) =>
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      let closed = false;

      request.raw.on("close", () => {
        closed = true;
      });

      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        const progress = fastify.minecraft.getDownloadProgress(
          software,
          version,
        );

        if (!progress) {
          send({
            percent: 0,
            status: "downloading",
            message: "Iniciando descarga...",
          });
          return;
        }

        send(progress);

        if (progress.status === "done" || progress.status === "error") {
          clearInterval(interval);
          reply.raw.end();
        }
      }, 500);
    },
  );

  // ── WS /api/minecraft/:id/console/ws ──────────────────
  // ⚠️  SIN preHandler — el JWT llega por query string
  fastify.get<{
    Params: { id: string };
    Querystring: { token?: string };
  }>(
    "/api/minecraft/:id/console/ws",
    {
      websocket: true,
    },
    (socket, request) => {
      // ── FIX: extrae el WebSocket nativo del SocketStream ─
      const ws = socket.socket;

      const token = (request.query as { token?: string }).token;

      if (!token) {
        ws.send(JSON.stringify({ type: "error", message: "No autorizado" }));
        ws.close();
        return;
      }

      try {
        fastify.jwt.verify(token);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Token inválido" }));
        ws.close();
        return;
      }

      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        ws.send(JSON.stringify({ type: "error", message: "ID inválido" }));
        ws.close();
        return;
      }
      let instance: ReturnType<
        typeof fastify.minecraft.getInstance_mem
      > | null = null;

      try {
        instance = fastify.minecraft.getInstance_mem(id);
      } catch {
        ws.send(
          JSON.stringify({ type: "error", message: "Instancia no encontrada" }),
        );
        ws.close();
        return;
      }

      // ── Historial acumulado ───────────────────────────
      if (instance.consoleLog.length > 0) {
        ws.send(
          JSON.stringify({ type: "history", lines: instance.consoleLog }),
        );
      }

      // ── Estado actual ─────────────────────────────────
      ws.send(
        JSON.stringify({
          type: "status",
          status: instance.status,
          playerCount: instance.playerCount,
          players: instance.players,
        }),
      );

      // ── Listeners ─────────────────────────────────────
      const onConsole = (msg: unknown) => {
        if (ws.readyState !== ws.OPEN) return;
        ws.send(JSON.stringify({ type: "console", line: msg }));
      };

      const onStatus = (status: string) => {
        if (ws.readyState !== ws.OPEN) return;
        ws.send(
          JSON.stringify({
            type: "status",
            status,
            playerCount: instance!.playerCount,
            players: instance!.players,
          }),
        );
      };

      const onPlayerJoin = (name: string) => {
        if (ws.readyState !== ws.OPEN) return;
        ws.send(
          JSON.stringify({
            type: "playerJoin",
            player: name,
            playerCount: instance!.playerCount,
            players: instance!.players,
          }),
        );
      };

      const onPlayerLeave = (name: string) => {
        if (ws.readyState !== ws.OPEN) return;
        ws.send(
          JSON.stringify({
            type: "playerLeave",
            player: name,
            playerCount: instance!.playerCount,
            players: instance!.players,
          }),
        );
      };

      instance.on("console", onConsole);
      instance.on("status", onStatus);
      instance.on("playerJoin", onPlayerJoin);
      instance.on("playerLeave", onPlayerLeave);

      // ── Mensajes entrantes del frontend ───────────────
      socket.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "command" && msg.command?.trim()) {
            if (instance!.isRunning) instance!.sendCommand(msg.command.trim());
          }
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          /* ignora mensajes malformados */
        }
      });

      // ── Limpieza ──────────────────────────────────────
      const cleanup = () => {
        instance!.off("console", onConsole);
        instance!.off("status", onStatus);
        instance!.off("playerJoin", onPlayerJoin);
        instance!.off("playerLeave", onPlayerLeave);
      };

      socket.on("close", cleanup);
      socket.on("error", cleanup);
    },
  );
}

// ── Helper: versiones disponibles por software ───────────
import axios from "axios";

async function _fetchVersions(software: string): Promise<string[]> {
  switch (software) {
    case "vanilla":
    case "fabric":
    case "forge":
    case "neoforge": {
      const res = await axios.get(
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
      );
      return res.data.versions
        .filter((v: any) => v.type === "release")
        .map((v: any) => v.id)
        .slice(0, 30);
    }

    case "paper": {
      const res = await axios.get("https://api.papermc.io/v2/projects/paper");
      return [...res.data.versions].reverse().slice(0, 30);
    }

    case "purpur": {
      const res = await axios.get("https://api.purpurmc.org/v2/purpur");
      return [...res.data.versions].reverse().slice(0, 50);
    }

    case "spigot":
    case "quilt":
    case "arclight":
    case "bedrock":
    case "pocketmine":
      return [
        "1.21.4",
        "1.21.3",
        "1.21.1",
        "1.20.6",
        "1.20.4",
        "1.20.2",
        "1.20.1",
        "1.19.4",
        "1.18.2",
        "1.17.1",
        "1.16.5",
      ];

    default:
      return ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4"];
  }
}
