CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (full_name, email, password_hash)
VALUES (
  'Usuário Teste',
  'admin@comepouco.local',
  '$2b$10$b7zfCxpmDzvUCvOPfNCod.najENVoynOPI6uxTkhv6rGUu3S7ao8m'
)
ON CONFLICT (email) DO NOTHING;
