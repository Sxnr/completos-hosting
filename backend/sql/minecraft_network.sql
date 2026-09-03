-- =========================================================
-- Quesito Hosting — Red y Dominio para instancias de Minecraft
-- Coronel SRV (_minecraft._tcp.<sub>) + CNAME al túnel Cloudflare.
-- Ejecutar después de schema.sql:
--   psql -U postgres -d completos_hosting -f sql/minecraft_network.sql
-- =========================================================

-- allocated_port: puerto TCP real que usa la instancia (lo asigna el
--   backend escaneando puertos libres a partir de MINECRAFT_BASE_PORT).
-- subdomain:      prefijo del subdominio amigable (ej. "server1").
--   El FQDN final es "<subdomain>.quesitohosting.shop".
-- dns_created:    marca si ya se publicaron los registros DNS (CNAME+SRV)
--   y el ingress del túnel cloudflared para evitar duplicados.
ALTER TABLE minecraft_instances
  ADD COLUMN IF NOT EXISTS allocated_port INTEGER,
  ADD COLUMN IF NOT EXISTS subdomain      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dns_created    BOOLEAN NOT NULL DEFAULT false;

-- Sincroniza allocated_port con el valor histórico de `port` para las
-- instancias que ya existían antes de esta migración (un solo backfill,
-- idempotente: solo afecta filas cuyo allocated_port es NULL).
UPDATE minecraft_instances
   SET allocated_port = port
 WHERE allocated_port IS NULL;

-- Garantiza unicidad: un subdominio no puede estar en dos instancias.
CREATE UNIQUE INDEX IF NOT EXISTS uq_minecraft_subdomain
  ON minecraft_instances (subdomain)
  WHERE subdomain IS NOT NULL;

-- Índice para la búsqueda del siguiente puerto libre.
CREATE INDEX IF NOT EXISTS idx_minecraft_allocated_port
  ON minecraft_instances (allocated_port);
