import argon2 from 'argon2';

import { db } from './connection';
import { logger } from '../utils/logger';

async function seedUsers(): Promise<void> {
  logger.info('Seeding users...');

  const password = await argon2.hash('Password123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const users = [
    {
      email: 'admin@example.com',
      name: 'Admin User',
      password_hash: password,
      email_verified: true,
      status: 'active',
    },
    {
      email: 'user@example.com',
      name: 'Test User',
      password_hash: password,
      email_verified: true,
      status: 'active',
    },
    {
      email: 'premium@example.com',
      name: 'Premium User',
      password_hash: password,
      email_verified: true,
      status: 'active',
    },
  ];

  for (const user of users) {
    await db.query(
      `INSERT INTO users (email, name, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [user.email, user.name, user.password_hash, user.email_verified, user.status]
    );
  }

  logger.info(`Seeded ${users.length} users`);
}

async function seedUserRoles(): Promise<void> {
  logger.info('Assigning roles to users...');

  // Get user and role IDs
  const adminUser = await db.query('SELECT id FROM users WHERE email = $1', [
    'admin@example.com',
  ]);
  const testUser = await db.query('SELECT id FROM users WHERE email = $1', ['user@example.com']);
  const premiumUser = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    'premium@example.com',
  ]);

  const adminRole = await db.query<{ id: string }>('SELECT id FROM roles WHERE name = $1', ['admin']);
  const userRole = await db.query<{ id: string }>('SELECT id FROM roles WHERE name = $1', ['user']);
  const premiumRole = await db.query<{ id: string }>('SELECT id FROM roles WHERE name = $1', ['premium']);

  if (adminUser.rows.length && adminRole.rows.length) {
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminUser.rows[0].id, adminRole.rows[0].id]
    );
  }

  if (testUser.rows.length && userRole.rows.length) {
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [testUser.rows[0].id, userRole.rows[0].id]
    );
  }

  if (premiumUser.rows.length && premiumRole.rows.length) {
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [premiumUser.rows[0].id, premiumRole.rows[0].id]
    );
  }

  logger.info('User roles assigned');
}

async function seedSubscriptions(): Promise<void> {
  logger.info('Creating test subscriptions...');

  const premiumUser = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    'premium@example.com',
  ]);
  const starterPlan = await db.query<{ id: string }>('SELECT id FROM subscription_plans WHERE name = $1', [
    'Starter',
  ]);

  if (premiumUser.rows.length && starterPlan.rows.length) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [premiumUser.rows[0].id, starterPlan.rows[0].id, 'active', now, periodEnd]
    );
  }

  logger.info('Test subscriptions created');
}

export async function seedDatabase(): Promise<void> {
  try {
    await db.connect();

    logger.info('Starting database seeding...');

    await seedUsers();
    await seedUserRoles();
    await seedSubscriptions();

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run seed if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seed process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed process failed', { error });
      process.exit(1);
    });
}
