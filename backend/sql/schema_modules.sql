-- =========================================================
-- Completo Hosting — Módulos nativos: Bases de Datos y Web
-- Ejecutar después de schema.sql:
--   psql -U postgres -d completos_hosting -f sql/schema_modules.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS database_instances (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  engine       VARCHAR(20)  NOT NULL
                 CHECK (engine IN ('postgresql', 'mariadb', 'mysql')),
  version      VARCHAR(20)  NOT NULL,
  port         INTEGER      NOT NULL,
  db_user      VARCHAR(80)  NOT NULL,
  db_password  VARCHAR(255) NOT NULL,
  datadir      VARCHAR(255) NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'offline',
  created_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_sites (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  root_dir     VARCHAR(255) NOT NULL,
  php_enabled  BOOLEAN      NOT NULL DEFAULT false,
  php_version  VARCHAR(20),
  fpm_port     INTEGER,
  ssl          BOOLEAN      NOT NULL DEFAULT false,
  status       VARCHAR(20)  NOT NULL DEFAULT 'offline',
  created_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_database_instances_port ON database_instances (port);
CREATE INDEX IF NOT EXISTS idx_web_sites_name ON web_sites (name);
