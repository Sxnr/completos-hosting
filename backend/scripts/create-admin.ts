// =========================================================
// SCRIPT — Crea el usuario admin inicial
// Ejecutar UNA sola vez: npx tsx scripts/create-admin.ts
// =========================================================

import 'dotenv/config'
import bcrypt from 'bcrypt'
import { Pool } from 'pg'

// Cambia estos valores antes de ejecutar
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin123'  // ← Cámbialo por uno seguro

async function createAdmin() {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'completos_hosting',
    user:     process.env.DB_USER     || 'completos',
    password: process.env.DB_PASSWORD || '',
  })

  try {
    // Genera el hash con 12 rondas de salt — balance seguridad/velocidad
    console.log('Generando hash de contraseña...')
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)

    // Inserta el usuario — si ya existe, actualiza el password
    const result = await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (username)
       DO UPDATE SET password = $2
       RETURNING id, username, role`,
      [ADMIN_USERNAME, hash]
    )

    console.log('✅ Usuario admin creado:')
    console.table(result.rows[0])
    console.log(`\nCredenciales de acceso:`) 
    console.log(`  Usuario:    ${ADMIN_USERNAME}`)
    console.log(`  Contraseña: ${ADMIN_PASSWORD}`)

  } catch (err) {
    console.error('❌ Error creando admin:', err)
  } finally {
    await pool.end()
  }
}

createAdmin()