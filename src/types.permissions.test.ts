import { describe, it, expect } from 'vitest';
import {
  User,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from './types';

/**
 * Pure authorization evaluation logic as implemented in the application
 * (matches AuthContext.hasPermission behavior).
 */
export function checkUserPermission(
  user: User | null | undefined,
  permission: keyof UserPermissions
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions && typeof user.permissions[permission] === 'boolean') {
    return user.permissions[permission]!;
  }
  const defaultPerms = DEFAULT_PERMISSIONS_BY_ROLE[user.role];
  return defaultPerms ? Boolean(defaultPerms[permission]) : false;
}

describe('Role & Permissions Logic', () => {
  describe('DEFAULT_PERMISSIONS_BY_ROLE completeness', () => {
    const allRoles: UserRole[] = ['admin', 'manager', 'agent'];
    const expectedPermissionKeys: (keyof UserPermissions)[] = [
      'canCreateContracts',
      'canEditContracts',
      'canValidateContracts',
      'canCancelContracts',
      'canDeleteContracts',
      'canExportData',
      'canManageDeposits',
      'canCollectDeposit',
      'canReleaseDeposit',
      'canDeductDeposit',
      'canAddVehicles',
      'canProposeVehicles',
      'canDirectAddVehicles',
      'canApproveVehicles',
      'canAssignFleet',
      'canAssignVehicleManager',
      'canEditVehicles',
      'canDeleteVehicles',
      'canManageMaintenanceExpenses',
      'canImportVehiclesExcel',
      'canManageClients',
      'canCreateClients',
      'canEditClients',
      'canDeleteClients',
      'canManageTerms',
      'canManageCompanySettings',
      'canViewAuditLogs',
      'canManagePermissions',
    ];

    it('defines permissions for all roles (admin, manager, agent)', () => {
      allRoles.forEach((role) => {
        expect(DEFAULT_PERMISSIONS_BY_ROLE[role]).toBeDefined();
      });
    });

    it('contains all expected permission keys for each role', () => {
      allRoles.forEach((role) => {
        const perms = DEFAULT_PERMISSIONS_BY_ROLE[role];
        expectedPermissionKeys.forEach((key) => {
          expect(perms[key]).toBeDefined();
          expect(typeof perms[key]).toBe('boolean');
        });
      });
    });
  });

  describe('Admin role permissions', () => {
    it('grants all permissions to Admin in DEFAULT_PERMISSIONS_BY_ROLE', () => {
      const adminPerms = DEFAULT_PERMISSIONS_BY_ROLE.admin;
      Object.entries(adminPerms).forEach(([key, value]) => {
        expect(value, `Admin should have permission ${key} set to true`).toBe(true);
      });
    });

    it('checkUserPermission returns true for Admin on all actions, even if permissions object is empty', () => {
      const admin: User = {
        id: 'usr-admin-1',
        name: 'Super Admin',
        email: 'admin@morvellocars.com',
        role: 'admin',
        permissions: {} as any,
      };

      expect(checkUserPermission(admin, 'canManagePermissions')).toBe(true);
      expect(checkUserPermission(admin, 'canDeleteContracts')).toBe(true);
      expect(checkUserPermission(admin, 'canDeleteVehicles')).toBe(true);
      expect(checkUserPermission(admin, 'canManageCompanySettings')).toBe(true);
    });
  });

  describe('Manager role permissions', () => {
    it('grants operational fleet and contract permissions to Manager', () => {
      const managerPerms = DEFAULT_PERMISSIONS_BY_ROLE.manager;
      expect(managerPerms.canCreateContracts).toBe(true);
      expect(managerPerms.canEditContracts).toBe(true);
      expect(managerPerms.canValidateContracts).toBe(true);
      expect(managerPerms.canExportData).toBe(true);
      expect(managerPerms.canManageDeposits).toBe(true);
      expect(managerPerms.canCollectDeposit).toBe(true);
      expect(managerPerms.canReleaseDeposit).toBe(true);
      expect(managerPerms.canDeductDeposit).toBe(true);
      expect(managerPerms.canAddVehicles).toBe(true);
      expect(managerPerms.canProposeVehicles).toBe(true);
      expect(managerPerms.canEditVehicles).toBe(true);
      expect(managerPerms.canDeleteVehicles).toBe(true);
      expect(managerPerms.canManageMaintenanceExpenses).toBe(true);
      expect(managerPerms.canManageClients).toBe(true);
      expect(managerPerms.canCreateClients).toBe(true);
      expect(managerPerms.canEditClients).toBe(true);
      expect(managerPerms.canDeleteClients).toBe(true);
    });

    it('strictly forbids critical administrative actions to Manager by default', () => {
      const managerPerms = DEFAULT_PERMISSIONS_BY_ROLE.manager;
      // Cannot cancel or delete contracts (requires admin approval)
      expect(managerPerms.canCancelContracts).toBe(false);
      expect(managerPerms.canDeleteContracts).toBe(false);
      // Cannot approve or directly bypass vehicle validation
      expect(managerPerms.canDirectAddVehicles).toBe(false);
      expect(managerPerms.canApproveVehicles).toBe(false);
      expect(managerPerms.canAssignFleet).toBe(false);
      expect(managerPerms.canAssignVehicleManager).toBe(false);
      expect(managerPerms.canImportVehiclesExcel).toBe(false);
      // Cannot access company settings, terms, audit logs or user permissions
      expect(managerPerms.canManageTerms).toBe(false);
      expect(managerPerms.canManageCompanySettings).toBe(false);
      expect(managerPerms.canViewAuditLogs).toBe(false);
      expect(managerPerms.canManagePermissions).toBe(false);
    });
  });

  describe('Agent role permissions and security boundaries', () => {
    it('grants only front-desk operational rights to Agent', () => {
      const agentPerms = DEFAULT_PERMISSIONS_BY_ROLE.agent;
      expect(agentPerms.canCreateContracts).toBe(true);
      expect(agentPerms.canManageDeposits).toBe(true);
      expect(agentPerms.canCollectDeposit).toBe(true);
      expect(agentPerms.canAddVehicles).toBe(true);
      expect(agentPerms.canProposeVehicles).toBe(true);
      expect(agentPerms.canManageClients).toBe(true);
      expect(agentPerms.canCreateClients).toBe(true);
    });

    it('strictly forbids ALL sensitive destructive and administrative permissions to Agent', () => {
      const agentPerms = DEFAULT_PERMISSIONS_BY_ROLE.agent;

      // No delete permissions
      expect(agentPerms.canDeleteContracts).toBe(false);
      expect(agentPerms.canDeleteVehicles).toBe(false);
      expect(agentPerms.canDeleteClients).toBe(false);

      // No contract modification / cancellation / validation
      expect(agentPerms.canEditContracts).toBe(false);
      expect(agentPerms.canValidateContracts).toBe(false);
      expect(agentPerms.canCancelContracts).toBe(false);

      // No financial deductions or releasing cautions
      expect(agentPerms.canReleaseDeposit).toBe(false);
      expect(agentPerms.canDeductDeposit).toBe(false);

      // No export data
      expect(agentPerms.canExportData).toBe(false);

      // No vehicle editing or approval
      expect(agentPerms.canEditVehicles).toBe(false);
      expect(agentPerms.canApproveVehicles).toBe(false);
      expect(agentPerms.canDirectAddVehicles).toBe(false);
      expect(agentPerms.canAssignFleet).toBe(false);
      expect(agentPerms.canAssignVehicleManager).toBe(false);
      expect(agentPerms.canManageMaintenanceExpenses).toBe(false);
      expect(agentPerms.canImportVehiclesExcel).toBe(false);

      // No client editing
      expect(agentPerms.canEditClients).toBe(false);

      // No system administration
      expect(agentPerms.canManagePermissions).toBe(false);
      expect(agentPerms.canManageCompanySettings).toBe(false);
      expect(agentPerms.canManageTerms).toBe(false);
      expect(agentPerms.canViewAuditLogs).toBe(false);
    });
  });

  describe('Custom user permission overrides', () => {
    it('allows granting a specific permission override to an Agent', () => {
      const agentWithEdit: User = {
        id: 'usr-agent-custom',
        name: 'Senior Agent',
        email: 'senior@morvellocars.com',
        role: 'agent',
        permissions: {
          ...DEFAULT_PERMISSIONS_BY_ROLE.agent,
          canEditContracts: true, // Special override
        },
      };

      expect(checkUserPermission(agentWithEdit, 'canEditContracts')).toBe(true);
      // Other restricted permissions remain false
      expect(checkUserPermission(agentWithEdit, 'canDeleteContracts')).toBe(false);
      expect(checkUserPermission(agentWithEdit, 'canManagePermissions')).toBe(false);
    });

    it('allows revoking a specific permission override from a Manager', () => {
      const restrictedManager: User = {
        id: 'usr-mgr-restricted',
        name: 'Junior Manager',
        email: 'jr.mgr@morvellocars.com',
        role: 'manager',
        permissions: {
          ...DEFAULT_PERMISSIONS_BY_ROLE.manager,
          canDeleteVehicles: false, // Revoked override
        },
      };

      expect(checkUserPermission(restrictedManager, 'canDeleteVehicles')).toBe(false);
      expect(checkUserPermission(restrictedManager, 'canEditVehicles')).toBe(true);
    });
  });

  describe('Boundary and unauthenticated checks', () => {
    it('returns false for null, undefined or unauthenticated user', () => {
      expect(checkUserPermission(null, 'canCreateContracts')).toBe(false);
      expect(checkUserPermission(undefined, 'canManagePermissions')).toBe(false);
    });

    it('handles user with invalid or empty role safely', () => {
      const weirdUser: any = {
        id: 'usr-unknown',
        role: 'guest',
      };
      expect(checkUserPermission(weirdUser, 'canCreateContracts')).toBe(false);
    });
  });
});
