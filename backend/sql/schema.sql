-- =========================================================
-- Completo Hosting — Esquema de base de datos (PostgreSQL)
-- Ejecutar con un usuario con permisos:
--   psql -U postgres -d completos_hosting -f sql/schema.sql
-- Luego crear el admin:
--   npx tsx scripts/create-admin.ts
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         VARCHAR(20)  NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('admin', 'viewer')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS minecraft_instances (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  software      VARCHAR(50)  NOT NULL,
  version       VARCHAR(50)  NOT NULL,
  edition       VARCHAR(20)  NOT NULL,
  port          INTEGER      NOT NULL,
  last_status   VARCHAR(20)  NOT NULL DEFAULT 'offline',
  ram_mb        INTEGER      NOT NULL DEFAULT 1024,
  java_flags    TEXT         NOT NULL DEFAULT '',
  folder_name   VARCHAR(150) NOT NULL,
  properties    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  tunnel_address VARCHAR(255),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minecraft_instances_port ON minecraft_instances (port);
