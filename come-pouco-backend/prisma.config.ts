import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.PRISMA_SCHEMA_ENGINE_BINARY) {
  const enginesDir = path.resolve(__dirname, 'node_modules', '@prisma', 'engines');

  if (fs.existsSync(enginesDir)) {
    const schemaEngineFile = fs
      .readdirSync(enginesDir)
      .find((file) => file.startsWith('schema-engine') && !file.endsWith('.gz') && !file.endsWith('.sha256'));

    if (schemaEngineFile) {
      process.env.PRISMA_SCHEMA_ENGINE_BINARY = path.join(enginesDir, schemaEngineFile);
    }
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
});
