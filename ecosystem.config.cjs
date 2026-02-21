// PM2 Configuration for Node.js + Hono server (AWS EC2 Production)
require('dotenv').config({ path: '.env.local' });

module.exports = {
  apps: [
    {
      name: 'streaming-platform',
      script: 'node',
      args: '--loader tsx src/server.ts',
      instances: 2, // Use 2 instances for load balancing (adjust based on CPU cores)
      exec_mode: 'cluster', // Cluster mode for better performance
      watch: false, // Disable file watching in production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/streaming_platform',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Production environment variables will be loaded from .env file
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
    },
  ],
};
