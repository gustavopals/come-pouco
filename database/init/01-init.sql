DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role "UserRole" NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (full_name, email, password_hash, role)
VALUES (
  'Usuário Teste',
  'admin@comepouco.local',
  '$2b$10$b7zfCxpmDzvUCvOPfNCod.najENVoynOPI6uxTkhv6rGUu3S7ao8m',
  'ADMIN'
)
ON CONFLICT (email) DO NOTHING;
