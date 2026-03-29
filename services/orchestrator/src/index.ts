import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const SERVICES = {
    auth:   'http://localhost:4002',
    docker: 'http://localhost:4001',
};

// Health check del Gateway
app.get('/status', (req: Request, res: Response) => {
    res.json({
        proyecto: 'Completos Hosting',
        gateway: 'Operativo',
        servicios: SERVICES,
        uptime: process.uptime()
    });
});

// --- Proxy manual hacia Auth Service ---
app.post('/auth/register', async (req: Request, res: Response) => {
    const response = await fetch(`${SERVICES.auth}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
});

app.post('/auth/login', async (req: Request, res: Response) => {
    const response = await fetch(`${SERVICES.auth}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
});

// --- Proxy hacia Docker Manager ---
app.get('/docker/containers', async (req: Request, res: Response) => {
    const response = await fetch(`${SERVICES.docker}/containers`);
    const data = await response.json();
    res.json(data);
});

app.get('/docker/info', async (req: Request, res: Response) => {
    const response = await fetch(`${SERVICES.docker}/info`);
    const data = await response.json();
    res.json(data);
});

app.get('/docker/metrics', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:4001/metrics');
        res.json(response.data);
    } catch {
        res.status(500).json({ error: 'Error conectando con docker-manager' });
    }
});

// --- Minecraft ---
app.get('/minecraft', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft`);
  res.json(await r.json());
});

app.post('/minecraft/create', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  res.status(r.status).json(await r.json());
});

app.post('/minecraft/:id/start', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/start`, { method: 'POST' });
  res.json(await r.json());
});

app.post('/minecraft/:id/stop', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/stop`, { method: 'POST' });
  res.json(await r.json());
});

app.post('/minecraft/:id/restart', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/restart`, { method: 'POST' });
  res.json(await r.json());
});

app.delete('/minecraft/:id', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}`, { method: 'DELETE' });
  res.json(await r.json());
});

app.get('/minecraft/:id/logs', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/logs`);
  res.json(await r.json());
});

app.get('/minecraft/:id/stats', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/stats`);
  res.json(await r.json());
});

app.get('/minecraft/:id/players', async (req: Request, res: Response) => {
  const r = await fetch(`${SERVICES.docker}/minecraft/${req.params.id}/players`);
  res.json(await r.json());
});

app.listen(PORT, () => {
    console.log(`🚀 COMPLETOS-HOSTING Gateway en http://localhost:${PORT}`);
});