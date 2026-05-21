const e2eConfig = {
  backendURL: process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001',
  frontendURL: process.env.E2E_FRONTEND_URL || 'http://127.0.0.1:4200',
  landingURL: process.env.E2E_LANDING_URL || 'http://127.0.0.1:4321',
  mailpitURL: process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:8025',
  databaseURL:
    process.env.DATABASE_URL ||
    'postgresql://come_pouco_user:come_pouco_pass@localhost:5432/come_pouco_db',
  defaultPassword: process.env.E2E_DEFAULT_PASSWORD || 'E2eStrongPass123!'
};

export { e2eConfig };
