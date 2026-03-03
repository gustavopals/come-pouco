DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyRole') THEN
    CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'EMPLOYEE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopeeMode') THEN
    CREATE TYPE "ShopeeMode" AS ENUM ('TEST', 'PROD');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) UNIQUE NOT NULL,
  shopee_platform_id INTEGER NULL,
  shopee_platform_test_id INTEGER NULL,
  shopee_platform_prod_id INTEGER NULL,
  shopee_mode "ShopeeMode" NOT NULL DEFAULT 'TEST',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role "UserRole" NOT NULL DEFAULT 'USER',
  company_id INTEGER NULL REFERENCES companies(id) ON DELETE SET NULL,
  company_role "CompanyRole" NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (full_name, email, password_hash, role)
VALUES (
  'Usuário Teste',
  'admin@comepouco.local',
  '$2b$10$6nEanPlogCDOrOTx9qaKv.TvBpecFEoNLFfHw7B7n/jbWLnyuw61y',
  'ADMIN'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO companies (name)
VALUES ('Default Company')
ON CONFLICT (name) DO NOTHING;
