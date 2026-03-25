import express, { Request, Response } from 'express';
import Dockerode from 'dockerode';

const app = express();
app.use(express.json());

// Socket de Windows para Docker Desktop
const docker = new Dockerode({ socketPath: '//./pipe/docker_engine' });

const PORT = process.env.PORT || 4001;

// Lista todos los contenedores (activos y detenidos)
app.get('/containers', async (req: Request, res: Response) => {
    const containers = await docker.listContainers({ all: true });
    res.json(containers.map(c => ({
        id: c.Id.slice(0, 12),
        nombre: c.Names[0],
        imagen: c.Image,
        estado: c.State,
        puertos: c.Ports
    })));
});

// Obtener info del sistema Docker
app.get('/info', async (req: Request, res: Response) => {
    const info = await docker.info();
    res.json({
        contenedores_activos: info.ContainersRunning,
        contenedores_totales: info.Containers,
        memoria_total: `${Math.round(info.MemTotal / 1024 / 1024 / 1024)} GB`,
        sistema_operativo: info.OperatingSystem
    });
});

app.listen(PORT, () => {
    console.log(`🐳 Docker Manager corriendo en http://localhost:${PORT}`);
});