// =========================================================
// DATABASES MODULE CONFIG — Bases de datos nativas en el host
// Cada instancia corre como proceso propio (initdb/postgres/
// mariadbd/mysqld) con su datadir en el disco del servidor.
// =========================================================

import path from 'path'

export const DB_MODULE_CONFIG = {
  // Directorio base donde viven las instancias (en el disco del host)
  baseDir:
    process.env.DB_INSTANCES_DIR ||
    path.join(process.cwd(), '../../db-instances'),

  // Binarios del sistema (configura según tu Debian)
  binaries: {
    postgresql: {
      initdb:  process.env.PG_INITDB  || 'initdb',
      server:  process.env.PG_SERVER  || 'postgres',
      dump:    process.env.PG_DUMP    || 'pg_dump',
      client:  process.env.PG_CLIENT  || 'psql',
    },
    mariadb: {
      server:  process.env.MARIADB_SERVER || 'mariadbd',
      dump:    process.env.MARIADB_DUMP   || 'mariadb-dump',
      client:  process.env.MARIADB_CLIENT || 'mariadb',
    },
    mysql: {
      server:  process.env.MYSQL_SERVER || 'mysqld',
      dump:    process.env.MYSQL_DUMP   || 'mysqldump',
      client:  process.env.MYSQL_CLIENT  || 'mysql',
    },
  },

  // Puertos base (se autoincrementan por instancia)
  basePort: parseInt(process.env.DB_BASE_PORT || '3306'),
  maxInstances: 10,
} as const
