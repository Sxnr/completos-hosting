import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import archiver from "archiver";
import AdmZip from "adm-zip";

const router = Router();

const SERVERS_DIR = process.env.MC_SERVERS_DIR || "/opt/minecraft-servers";
const JARS_CACHE = path.join(SERVERS_DIR, ".jars");
[SERVERS_DIR, JARS_CACHE].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Helpers ───────────────────────────────────────────────────
function qstr(val: unknown): string {
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}
type P = { id: string };

// ── Estado en memoria ─────────────────────────────────────────
interface ProcInfo {
  proc: ReturnType<typeof spawn>;
  pid: number;
  startTime: number;
  logs: string[];
}
const procs = new Map<string, ProcInfo>();

// ── Base de datos JSON simple ─────────────────────────────────
interface ServerRecord {
  id: string;
  nombre: string;
  version: string;
  memoria: string;
  puerto: number;
  creado: string;
}
const DB_PATH = path.join(SERVERS_DIR, "servers.json");
let db: ServerRecord[] = [];
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
} catch {}
const saveDB = () =>
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// ── Descarga JAR oficial de Mojang ────────────────────────────
async function getServerJAR(version: string): Promise<string> {
  const cached = path.join(JARS_CACHE, `${version}.jar`);
  if (fs.existsSync(cached)) return cached;

  const manifest: any = await fetch(
    "https://launchermeta.mojang.com/mc/game/version_manifest.json"
  ).then((r) => r.json());

  const vInfo = manifest.versions.find((v: any) => v.id === version);
  if (!vInfo) throw new Error(`Versión ${version} no encontrada en Mojang`);

  const meta: any = await fetch(vInfo.url).then((r) => r.json());
  const jarUrl = meta.downloads?.server?.url;
  if (!jarUrl) throw new Error(`No hay server JAR oficial para ${version}`);

  const arrayBuf = await fetch(jarUrl).then((r) => r.arrayBuffer());
  const buf = Buffer.from(new Uint8Array(arrayBuf));
  fs.writeFileSync(cached, buf);
  return cached;
}

// ── Path seguro para File Manager ─────────────────────────────
function safePath(id: string, sub: string = ""): string {
  const base = path.resolve(SERVERS_DIR, id);
  const full = path.resolve(base, sub);
  if (!full.startsWith(base)) throw new Error("Ruta inválida");
  return full;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function startProcess(id: string, srv: ServerRecord): void {
  const dir = path.join(SERVERS_DIR, id);
  const memN = parseInt(srv.memoria);
  const memU = srv.memoria.replace(/\d/g, "");
  const xms =
    memN >= 2 ? `${Math.max(1, Math.floor(memN / 2))}${memU}` : "512M";

  const proc = spawn(
    "java",
    [`-Xmx${srv.memoria}`, `-Xms${xms}`, "-jar", "server.jar", "nogui"],
    { cwd: dir, stdio: ["pipe", "pipe", "pipe"] }
  );

  const info: ProcInfo = {
    proc,
    pid: proc.pid!,
    startTime: Date.now(),
    logs: [],
  };
  procs.set(id, info);

  const addLog = (d: Buffer) => {
    info.logs.push(d.toString());
    if (info.logs.length > 800) info.logs.shift();
  };
  proc.stdout!.on("data", addLog);
  proc.stderr!.on("data", (d: Buffer) =>
    addLog(Buffer.from("[ERR] " + d.toString()))
  );
  proc.on("exit", () => procs.delete(id));
}

const upload = multer({ dest: "/tmp/mc-uploads/" });

// ══════════════════════════════════════════════════════════════
// CRUD
// ══════════════════════════════════════════════════════════════

router.get("/", (_req, res) => {
  res.json(
    db.map((s) => ({
      ...s,
      estado: procs.has(s.id) ? "running" : "stopped",
    }))
  );
});

router.post("/create", async (req: Request, res: Response) => {
  const { nombre, version, memoria, puerto } = req.body;
  if (!nombre || !version || !memoria || !puerto)
    return res.status(400).json({ error: "Faltan campos requeridos" });

  const id = uuidv4().slice(0, 8);
  const dir = path.join(SERVERS_DIR, id);

  try {
    fs.mkdirSync(dir, { recursive: true });
    const jar = await getServerJAR(version);
    fs.copyFileSync(jar, path.join(dir, "server.jar"));
    fs.writeFileSync(path.join(dir, "eula.txt"), "eula=true\n");
    fs.writeFileSync(
      path.join(dir, "server.properties"),
      [
        `server-port=${puerto}`,
        "online-mode=false",
        "max-players=20",
        `motd=Completos Hosting - ${nombre}`,
      ].join("\n")
    );

    const srv: ServerRecord = {
      id,
      nombre,
      version,
      memoria,
      puerto: Number(puerto),
      creado: new Date().toISOString(),
    };
    db.push(srv);
    saveDB();
    res.json({ ...srv, estado: "stopped" });
  } catch (err: any) {
    try { fs.rmSync(dir, { recursive: true }); } catch {}
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/start", (req: Request<P>, res: Response) => {
  const { id } = req.params;
  if (procs.has(id))
    return res.status(400).json({ error: "Ya está corriendo" });

  const srv = db.find((s) => s.id === id);
  if (!srv) return res.status(404).json({ error: "Servidor no encontrado" });

  try {
    startProcess(id, srv);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/stop", (req: Request<P>, res: Response) => {
  const info = procs.get(req.params.id);
  if (!info) return res.status(400).json({ error: "No está corriendo" });
  info.proc.stdin!.write("stop\n");
  setTimeout(() => {
    if (procs.has(req.params.id)) info.proc.kill("SIGTERM");
  }, 12000);
  res.json({ ok: true });
});

router.post("/:id/restart", async (req: Request<P>, res: Response) => {
  const { id } = req.params;
  const info = procs.get(id);

  if (info) {
    info.proc.stdin!.write("stop\n");
    await new Promise<void>((r) => {
      info.proc.once("exit", () => r());
      setTimeout(r, 15000);
    });
  }

  const srv = db.find((s) => s.id === id);
  if (!srv) return res.status(404).json({ error: "Servidor no encontrado" });

  try {
    startProcess(id, srv);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", (req: Request<P>, res: Response) => {
  const { id } = req.params;
  const info = procs.get(id);
  if (info) {
    info.proc.kill("SIGTERM");
    procs.delete(id);
  }
  try {
    fs.rmSync(path.join(SERVERS_DIR, id), { recursive: true });
  } catch {}
  const i = db.findIndex((s) => s.id === id);
  if (i !== -1) { db.splice(i, 1); saveDB(); }
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// STATS, LOGS, PLAYERS, COMMAND
// ══════════════════════════════════════════════════════════════

router.get("/:id/stats", async (req: Request<P>, res: Response) => {
  const info = procs.get(req.params.id);
  if (!info) return res.json({ running: false });
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pidusage = require("pidusage");
    const stats = await pidusage(info.pid);
    res.json({
      running: true,
      cpuPercent: Math.round(stats.cpu * 10) / 10,
      memUsage: stats.memory,
      memLimit: os.totalmem(),
      uptime: Date.now() - info.startTime,
      netIn: 0,
      netOut: 0,
    });
  } catch {
    res.json({
      running: true,
      cpuPercent: 0,
      memUsage: 0,
      memLimit: os.totalmem(),
      uptime: Date.now() - info.startTime,
      netIn: 0,
      netOut: 0,
    });
  }
});

router.get("/:id/logs", (req: Request<P>, res: Response) => {
  const info = procs.get(req.params.id);
  if (info) return res.json({ logs: info.logs.slice(-300).join("") });
  try {
    const log = fs.readFileSync(
      path.join(SERVERS_DIR, req.params.id, "logs", "latest.log"),
      "utf8"
    );
    res.json({ logs: log.slice(-15000) });
  } catch {
    res.json({ logs: "" });
  }
});

router.get("/:id/players", (req: Request<P>, res: Response) => {
  const info = procs.get(req.params.id);
  if (!info) return res.json({ players: [], ready: false, maxPlayers: 20 });

  const recent = info.logs.slice(-100).join("");
  const ready = recent.includes("Done (") && recent.includes('"help"');
  const joined = [...recent.matchAll(/(\w+) joined the game/g)].map((m) => m[1]);
  const left = new Set(
    [...recent.matchAll(/(\w+) left the game/g)].map((m) => m[1])
  );
  const players = [...new Set(joined)].filter((p) => !left.has(p));

  res.json({ players, ready, maxPlayers: 20 });
});

router.post("/:id/command", (req: Request<P>, res: Response) => {
  const info = procs.get(req.params.id);
  if (!info) return res.status(400).json({ error: "No está corriendo" });
  info.proc.stdin!.write((req.body.command || "") + "\n");
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// FILE MANAGER
// ══════════════════════════════════════════════════════════════

router.get("/:id/files", async (req: Request<P>, res: Response) => {
  try {
    const subPath = qstr(req.query.path);
    const full = safePath(req.params.id, subPath);
    const stat = await fsp.stat(full);

    if (!stat.isDirectory()) {
      const content = await fsp.readFile(full, "utf8");
      return res.json({ type: "file", content });
    }

    const entries = await fsp.readdir(full, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (e) => {
        const s = await fsp.stat(path.join(full, e.name)).catch(() => null);
        return {
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
          size: s?.size ?? 0,
          sizeStr: fmtSize(s?.size ?? 0),
          modified: s?.mtime ?? null,
          path: path.posix.join(subPath, e.name),
        };
      })
    );

    res.json({
      type: "dir",
      files: files.sort((a, b) =>
        a.type !== b.type
          ? a.type === "dir" ? -1 : 1
          : a.name.localeCompare(b.name)
      ),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/:id/upload-world",
  upload.single("world"),
  async (req: Request<P>, res: Response) => {
    try {
      const serverDir = path.join(SERVERS_DIR, req.params.id);
      const worldDir = path.join(serverDir, "world");

      if (fs.existsSync(worldDir))
        fs.renameSync(worldDir, `${worldDir}_backup_${Date.now()}`);

      const zip = new AdmZip((req.file as Express.Multer.File).path);
      zip.extractAllTo(serverDir, true);
      fs.unlinkSync((req.file as Express.Multer.File).path);

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get("/:id/download-world", (req: Request<P>, res: Response) => {
  const worldDir = path.join(SERVERS_DIR, req.params.id, "world");
  if (!fs.existsSync(worldDir))
    return res.status(404).json({ error: "No hay mundo aún" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="world-${req.params.id}.zip"`
  );

  const arc = archiver("zip", { zlib: { level: 6 } });
  arc.pipe(res);
  arc.directory(worldDir, "world");
  arc.finalize();
});

router.delete("/:id/files", async (req: Request<P>, res: Response) => {
  try {
    await fsp.rm(safePath(req.params.id, qstr(req.query.path)), {
      recursive: true,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;