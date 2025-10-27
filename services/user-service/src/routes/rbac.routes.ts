import { Router } from 'express';
import { rbacController } from '../controllers/rbac.controller';

const router = Router();

// Role management (admin only)
router.post('/roles', rbacController.createRole.bind(rbacController));
router.get('/roles', rbacController.getRoles.bind(rbacController));
router.get('/roles/:roleId', rbacController.getRoleById.bind(rbacController));
router.patch('/roles/:roleId', rbacController.updateRole.bind(rbacController));
router.delete('/roles/:roleId', rbacController.deleteRole.bind(rbacController));

// User role assignment (admin only)
router.post('/users/:userId/roles', rbacController.assignRole.bind(rbacController));
router.delete('/users/:userId/roles/:roleId', rbacController.removeRole.bind(rbacController));

// Permissions
router.get('/permissions', rbacController.getPermissions.bind(rbacController));
router.get('/users/:userId/permissions', rbacController.getUserPermissions.bind(rbacController));

export default router;
