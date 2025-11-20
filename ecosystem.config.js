module.exports = {
  apps: [
    {
      name: 'workradius-server',
      cwd: './server',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'workradius-client',
      cwd: './client',
      script: 'node_modules/.bin/serve',
      args: 'dist -l 4173',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      wait_ready: false,
    },
  ],
};

