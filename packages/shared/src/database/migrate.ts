import fs from 'fs';
import path from 'path';

import { db } from './connection';
import { logger } from '../utils/logger';

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
}

async function createMigrationsTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await db.query(sql);
  logger.info('Migrations table ready');
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db.query<{ name: string }>('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row) => row.name);
}

function loadMigrationFiles(): Migration[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  return files.map((filename) => {
    const match = filename.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }

    const id = parseInt(match[1], 10);
    const name = match[2];
    const filepath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    return { id, name, filename, sql };
  });
}

async function executeMigration(migration: Migration): Promise<void> {
  logger.info(`Executing migration: ${migration.filename}`);

  await db.transaction(async (client) => {
    // Execute the migration SQL
    await client.query(migration.sql);

    // Record the migration
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.filename]);
  });

  logger.info(`Migration completed: ${migration.filename}`);
}

export async function runMigrations(): Promise<void> {
  try {
    await db.connect();
    await createMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = loadMigrationFiles();

    const pendingMigrations = allMigrations.filter(
      (m) => !executedMigrations.includes(m.filename)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed', { error });
      process.exit(1);
    });
}
