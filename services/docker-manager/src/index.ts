import express, { Request, Response } from 'express';
import Docker from 'dockerode';
import os from 'os';
import mcRouter from './minecraft';

const app = express();
app.use(express.json());

// Socket de Windows para Docker Desktop
const isWindows = process.platform === 'win32';
const docker = new Docker({
  socketPath: isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

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

// Agregar ANTES del app.get('/metrics', ...) — fuera del handler:
let prevCpuTimes = os.cpus().map(c => ({ ...c.times }));

app.get('/metrics', async (req, res) => {
    try {
        const currCpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Calcular CPU con delta entre lecturas
        let totalDelta = 0, idleDelta = 0;
        currCpus.forEach((cpu, i) => {
            const prev = prevCpuTimes[i];
            const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
            const currTotal = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            totalDelta += currTotal - prevTotal;
            idleDelta += cpu.times.idle - prev.idle;
        });
        prevCpuTimes = currCpus.map(c => ({ ...c.times }));

        const cpuPromedio = totalDelta > 0
            ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100)
            : 0;

        res.json({
            cpu: cpuPromedio,
            memoriaUsada: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
            memoriaTotal: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
            memoriaPorcentaje: Math.round((usedMem / totalMem) * 100),
            uptime: Math.floor(os.uptime() / 3600),
            nucleos: currCpus.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo métricas' });
    }
});

app.use('/minecraft', mcRouter);

app.listen(PORT, () => {
    console.log(`🐳 Docker Manager corriendo en http://localhost:${PORT}`);
});