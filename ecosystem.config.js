module.exports = {
  apps: [
    {
      name:        'completo-hosting-backend',
      cwd:         '/opt/completo-hosting/backend',
      script:      'dist/server.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT:     3001,
      },
      error_file: '/var/log/completo-hosting/backend-error.log',
      out_file:   '/var/log/completo-hosting/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
