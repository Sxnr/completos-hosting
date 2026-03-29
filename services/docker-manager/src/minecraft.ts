import { Router, Request, Response } from 'express';
import Docker from 'dockerode';
import * as fs from 'fs';

const router = Router();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const MC_DATA_BASE = '/opt/minecraft-servers';
const MC_LABEL = 'completos-hosting.type';
const MC_LABEL_VAL = 'minecraft';

router.get('/', async (req: Request, res: Response) => {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: JSON.stringify({ label: [`${MC_LABEL}=${MC_LABEL_VAL}`] })
    });
    res.json(containers.map(c => ({
      id: c.Id.slice(0, 12),
      nombre: c.Labels['mc.name'] || c.Names[0]?.replace('/', ''),
      version: c.Labels['mc.version'] || 'desconocida',
      memoria: c.Labels['mc.memory'] || '1G',
      estado: c.State,
      puerto: c.Ports.find(p => p.PrivatePort === 25565)?.PublicPort || null,
      creado: new Date(c.Created * 1000).toISOString()
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/create', async (req: Request, res: Response) => {
  const { nombre, version = '1.20.4', memoria = '2G', puerto } = req.body;
  if (!nombre || !puerto) return res.status(400).json({ error: 'nombre y puerto son requeridos' });

  const slug = nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const dataPath = `${MC_DATA_BASE}/${slug}`;

  try {
    fs.mkdirSync(dataPath, { recursive: true });
    const container = await docker.createContainer({
      Image: 'itzg/minecraft-server',
      name: `mc-${slug}`,
      Env: [
        'EULA=TRUE',
        'TYPE=VANILLA',
        `VERSION=${version}`,
        `MEMORY=${memoria}`,
        'ONLINE_MODE=FALSE'
      ],
      Labels: {
        [MC_LABEL]: MC_LABEL_VAL,
        'mc.name': nombre,
        'mc.version': version,
        'mc.memory': memoria
      },
      ExposedPorts: { '25565/tcp': {} },
      HostConfig: {
        PortBindings: { '25565/tcp': [{ HostPort: String(puerto) }] },
        Binds: [`${dataPath}:/data`],
        RestartPolicy: { Name: 'unless-stopped' }
      }
    });
    await container.start();
    res.json({ success: true, id: container.id.slice(0, 12), nombre, version, memoria, puerto });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    await docker.getContainer(req.params.id as string).start();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    await docker.getContainer(req.params.id as string).stop();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restart', async (req: Request, res: Response) => {
  try {
    await docker.getContainer(req.params.id as string).restart();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const c = docker.getContainer(req.params.id as string);
    const info = await c.inspect();
    if (info.State.Running) await c.stop({ t: 10 });
    await c.remove();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const stream = await docker.getContainer(req.params.id as string).logs({
      stdout: true, stderr: true, tail: 100
    });
    const raw = stream.toString('utf8');
    const lines = raw.split('\n').map(l => l.length > 8 ? l.slice(8) : l).join('\n');
    res.json({ logs: lines });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/stats — CPU, RAM, Red, Uptime
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const container = docker.getContainer(req.params.id as string);
    const [statsRaw, info] = await Promise.all([
      container.stats({ stream: false }),
      container.inspect()
    ]);

    const cpuDelta = statsRaw.cpu_stats.cpu_usage.total_usage - statsRaw.precpu_stats.cpu_usage.total_usage;
    const systemDelta = (statsRaw.cpu_stats.system_cpu_usage || 0) - (statsRaw.precpu_stats.system_cpu_usage || 0);
    const numCpus = statsRaw.cpu_stats.online_cpus || 1;
    const cpuPercent = systemDelta > 0 ? Math.min((cpuDelta / systemDelta) * numCpus * 100, 100) : 0;

    const cache = statsRaw.memory_stats?.stats?.cache || 0;
    const memUsage = (statsRaw.memory_stats?.usage || 0) - cache;
    const memLimit = statsRaw.memory_stats?.limit || 0;

    const networks = statsRaw.networks || {};
    const netIn  = Object.values(networks as any).reduce((a: number, n: any) => a + (n.rx_bytes || 0), 0) as number;
    const netOut = Object.values(networks as any).reduce((a: number, n: any) => a + (n.tx_bytes || 0), 0) as number;

    const startedAt = info.State?.StartedAt;
    const uptime = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;

    res.json({
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      memUsage, memLimit, netIn, netOut, uptime,
      running: info.State?.Running
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/players — jugadores online desde logs
router.get('/:id/players', async (req: Request, res: Response) => {
  try {
    const stream = await docker.getContainer(req.params.id as string).logs({
      stdout: true, stderr: true, tail: 1000
    });
    const lines = stream.toString('utf8').split('\n').map(l => l.length > 8 ? l.slice(8) : l);
    const online: Set<string> = new Set();
    lines.forEach(line => {
      const join  = line.match(/(\w+) joined the game/);
      const leave = line.match(/(\w+) left the game/);
      if (join)  online.add(join[1]);
      if (leave) online.delete(leave[1]);
    });
    const ready  = lines.some(l => l.includes('Done') && l.includes('For help'));
    const maxPl  = lines.map(l => l.match(/max\. (\d+) player/)).filter(Boolean).pop();
    res.json({ players: Array.from(online), ready, maxPlayers: maxPl ? parseInt(maxPl[1]) : 20 });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;