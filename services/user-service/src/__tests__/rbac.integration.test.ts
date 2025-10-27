import request from 'supertest';
import app from '../index';
import { db, redis } from '@auth/shared';

describe('RBAC Integration Tests', () => {
  let adminToken: string;
  let adminUserId: string;
  let testUserId: string;
  let testRoleId: string;

  beforeAll(async () => {
    await db.connect();
    await redis.connect();

    // Create test admin user
    adminUserId = 'admin-user-id';
    testUserId = 'test-user-id';
    adminToken = 'mock-admin-jwt-token';

    // Create test user in database
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testUserId, 'test@example.com', 'Test User', 'hash', true, 'active']
    );
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM roles WHERE is_system = false');
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);

    await db.disconnect();
    await redis.disconnect();
  });

  describe('POST /api/v1/roles', () => {
    it('should create a new role', async () => {
      const response = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Role',
          description: 'A test role',
          permissions: ['users:read', 'users:write'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Role');
      expect(response.body.description).toBe('A test role');
      expect(response.body.permissions).toEqual(['users:read', 'users:write']);
      expect(response.body.isSystem).toBe(false);

      testRoleId = response.body.id;
    });

    it('should reject duplicate role names', async () => {
      await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Role',
          description: 'Another test role',
          permissions: ['users:read'],
        })
        .expect(500);
    });

    it('should reject invalid permissions', async () => {
      await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Role',
          description: 'Role with invalid permissions',
          permissions: ['invalid:permission'],
        })
        .expect(500);
    });

    it('should create role with parent role', async () => {
      const response = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Child Role',
          description: 'A child role',
          permissions: ['sessions:read'],
          parentRoleId: testRoleId,
        })
        .expect(201);

      expect(response.body.parentRoleId).toBe(testRoleId);
    });
  });

  describe('GET /api/v1/roles', () => {
    it('should return all roles', async () => {
      const response = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.roles).toBeInstanceOf(Array);
      expect(response.body.roles.length).toBeGreaterThan(0);
      expect(response.body.roles[0]).toHaveProperty('id');
      expect(response.body.roles[0]).toHaveProperty('name');
      expect(response.body.roles[0]).toHaveProperty('permissions');
    });
  });

  describe('GET /api/v1/roles/:roleId', () => {
    it('should return role by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(testRoleId);
      expect(response.body.name).toBe('Test Role');
    });

    it('should return 404 for non-existent role', async () => {
      await request(app)
        .get('/api/v1/roles/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/roles/:roleId', () => {
    it('should update role', async () => {
      const response = await request(app)
        .patch(`/api/v1/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description',
          permissions: ['users:read', 'users:write', 'users:delete'],
        })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.permissions).toContain('users:delete');
    });

    it('should reject updating system role', async () => {
      // Create a system role
      const systemRole = await db.query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['System Role', 'A system role', ['admin:access'], true]
      );

      await request(app)
        .patch(`/api/v1/roles/${systemRole.rows[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Try to update',
        })
        .expect(500);
    });
  });

  describe('POST /api/v1/users/:userId/roles', () => {
    it('should assign role to user', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: testRoleId,
        })
        .expect(200);

      expect(response.body.message).toBe('Role assigned successfully');

      // Verify in database
      const result = await db.query(
        'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
        [testUserId, testRoleId]
      );

      expect(result.rows.length).toBe(1);
    });

    it('should reject duplicate role assignment', async () => {
      await request(app)
        .post(`/api/v1/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: testRoleId,
        })
        .expect(500);
    });

    it('should reject non-existent role', async () => {
      await request(app)
        .post(`/api/v1/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: 'non-existent-role-id',
        })
        .expect(500);
    });
  });

  describe('GET /api/v1/users/:userId/permissions', () => {
    it('should return user permissions', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.permissions).toBeInstanceOf(Array);
      expect(response.body.permissions).toContain('users:read');
      expect(response.body.permissions).toContain('users:write');
    });

    it('should include inherited permissions from parent role', async () => {
      // Create parent role
      const parentRole = await db.query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Parent Role', 'Parent role', ['sessions:read'], false]
      );

      // Create child role with parent
      const childRole = await db.query(
        `INSERT INTO roles (name, description, permissions, parent_role_id, is_system)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['Child Role Test', 'Child role', ['sessions:write'], parentRole.rows[0].id, false]
      );

      // Assign child role to user
      await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
        testUserId,
        childRole.rows[0].id,
      ]);

      // Clear cache
      await redis.del(`user_permissions:${testUserId}`);

      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should have both child and parent permissions
      expect(response.body.permissions).toContain('sessions:read'); // from parent
      expect(response.body.permissions).toContain('sessions:write'); // from child
    });
  });

  describe('DELETE /api/v1/users/:userId/roles/:roleId', () => {
    it('should remove role from user', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${testUserId}/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Role removed successfully');

      // Verify in database
      const result = await db.query(
        'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
        [testUserId, testRoleId]
      );

      expect(result.rows.length).toBe(0);
    });

    it('should reject removing non-assigned role', async () => {
      await request(app)
        .delete(`/api/v1/users/${testUserId}/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);
    });
  });

  describe('DELETE /api/v1/roles/:roleId', () => {
    it('should reject deleting role assigned to users', async () => {
      // Assign role to user
      await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
        testUserId,
        testRoleId,
      ]);

      await request(app)
        .delete(`/api/v1/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      // Clean up
      await db.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [
        testUserId,
        testRoleId,
      ]);
    });

    it('should delete role not assigned to users', async () => {
      const response = await request(app)
        .delete(`/api/v1/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Role deleted successfully');

      // Verify in database
      const result = await db.query('SELECT * FROM roles WHERE id = $1', [testRoleId]);

      expect(result.rows.length).toBe(0);
    });

    it('should reject deleting system role', async () => {
      const systemRole = await db.query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['System Role 2', 'Another system role', ['admin:manage'], true]
      );

      await request(app)
        .delete(`/api/v1/roles/${systemRole.rows[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);
    });
  });

  describe('GET /api/v1/permissions', () => {
    it('should return all available permissions', async () => {
      const response = await request(app)
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.permissions).toBeInstanceOf(Array);
      expect(response.body.permissions.length).toBeGreaterThan(0);
      expect(response.body.permissions[0]).toHaveProperty('id');
      expect(response.body.permissions[0]).toHaveProperty('resource');
      expect(response.body.permissions[0]).toHaveProperty('action');
      expect(response.body.permissions[0]).toHaveProperty('description');
    });
  });

  describe('Permission Caching', () => {
    it('should cache user permissions', async () => {
      // First request - should hit database
      await request(app)
        .get(`/api/v1/users/${testUserId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check if cached
      const cached = await redis.get(`user_permissions:${testUserId}`);
      expect(cached).not.toBeNull();

      // Second request - should hit cache
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.permissions).toBeInstanceOf(Array);
    });

    it('should invalidate cache when role is assigned', async () => {
      // Create a new role
      const newRole = await db.query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Cache Test Role', 'For testing cache', ['payments:read'], false]
      );

      // Assign role (should invalidate cache)
      await request(app)
        .post(`/api/v1/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: newRole.rows[0].id,
        })
        .expect(200);

      // Check cache is cleared
      const cached = await redis.get(`user_permissions:${testUserId}`);
      expect(cached).toBeNull();
    });
  });
});
