import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

app.listen(PORT, () => {
    console.log(`🚀 COMPLETOS-HOSTING Gateway en http://localhost:${PORT}`);
});