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

export default router;