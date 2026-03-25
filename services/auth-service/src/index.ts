import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;
const JWT_SECRET = process.env.JWT_SECRET!;

// Conexión a PostgreSQL
const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Crear tabla de usuarios al iniciar
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT NOW()
    )
`).then(() => console.log('✅ Tabla users lista'));

// Registro de usuario
app.post('/register', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2)',
        [username, hashed]
    );
    res.json({ mensaje: `Usuario ${username} creado correctamente` });
});

// Login
app.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, usuario: user.username });
});

app.listen(PORT, () => {
    console.log(`🔐 Auth Service corriendo en http://localhost:${PORT}`);
});