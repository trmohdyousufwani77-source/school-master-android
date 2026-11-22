import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import {
  AdminAuditChangeLog,
  AdminRoleType,
  AdminUser,
  PermissionKey,
  SecuritySettings,
} from '../types';
import {
  ALL_PERMISSIONS,
  initialSecuritySettings,
  resolveUserPermissions,
  sampleAdminAuditLogs,
  sampleAdminUsers,
} from '../utils/sampleData';

const STORAGE_PREFIX = 'school_master_admin_v1_';

interface PermissionsContextType {
  currentUser: AdminUser;
  adminUsers: AdminUser[];
  currentRole: AdminRoleType;
  effectiveRole: AdminRoleType;
  simulatedRole: AdminRoleType | null;
  setSimulatedRole: (role: AdminRoleType | null) => void;
  hasPermission: (key: PermissionKey) => boolean;
  canAccessTab: (tab: string) => boolean;
  securitySettings: SecuritySettings;
  updateSecuritySettings: (settings: SecuritySettings) => void;
  auditLogs: AdminAuditChangeLog[];
  addAuditLog: (log: Omit<AdminAuditChangeLog, 'id' | 'timestamp'>) => void;
  updateAdminUser: (updatedUser: AdminUser, oldUser?: AdminUser) => void;
  deleteAdminUser: (userId: string) => { success: boolean; message: string };
  addAdminUser: (newUser: Partial<AdminUser> & { name: string; email: string; role: AdminRoleType }) => void;
  setCurrentUserById: (userId: string) => void;
  purgeSyncedData: () => { count: number; archivedData: string };
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Admin Users list
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fallback */
      }
    }
    return sampleAdminUsers;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(adminUsers));
  }, [adminUsers]);

  // 2. Current User
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}current_user_id`);
    return saved || 'user-admin-wani';
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}current_user_id`, currentUserId);
  }, [currentUserId]);

  const currentUser = useMemo(() => {
    return adminUsers.find((u) => u.id === currentUserId) || adminUsers[0];
  }, [adminUsers, currentUserId]);

  // 3. User View Simulation (allows previewing as Teacher, Junior Admin, Senior Admin)
  const [simulatedRole, setSimulatedRole] = useState<AdminRoleType | null>(null);

  const effectiveRole: AdminRoleType = simulatedRole || currentUser.role;

  // 4. Security Settings
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}security_settings`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fallback */
      }
    }
    return initialSecuritySettings;
  });

  const updateSecuritySettings = (settings: SecuritySettings) => {
    setSecuritySettings(settings);
    localStorage.setItem(`${STORAGE_PREFIX}security_settings`, JSON.stringify(settings));

    addAuditLog({
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      actionType: 'SECURITY_POLICY_UPDATE',
      description: `Updated security rules: min len ${settings.minPasswordLength}, 2FA ${
        settings.twoFactorEnforced ? 'Enforced' : 'Off'
      }, timeout ${settings.sessionTimeoutMinutes}m`,
      newValue: JSON.stringify(settings),
      status: 'SUCCESS',
    });
  };

  // 5. Audit Logs
  const [auditLogs, setAuditLogs] = useState<AdminAuditChangeLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}audit_logs`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fallback */
      }
    }
    return sampleAdminAuditLogs;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = (entry: Omit<AdminAuditChangeLog, 'id' | 'timestamp'>) => {
    const newEntry: AdminAuditChangeLog = {
      ...entry,
      id: `audit-sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.' + (100 + Math.floor(Math.random() * 50)),
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // 6. Check specific permission
  const hasPermission = (key: PermissionKey): boolean => {
    const permissions = resolveUserPermissions(effectiveRole, currentUser.customPermissions);
    return Boolean(permissions[key]);
  };

  // 7. Check Tab Access
  const canAccessTab = (tab: string): boolean => {
    // Teacher roles are strictly restricted from School Settings, Admin Access Control, Super Admin, and Backup
    if (effectiveRole === 'teacher') {
      if (tab === 'settings' || tab === 'admin-access' || tab === 'super-admin' || tab === 'backup') {
        return false;
      }
    }
    if (effectiveRole === 'junior_admin') {
      if (tab === 'settings' || tab === 'backup') {
        return false;
      }
    }
    return true;
  };

  // 8. Update Admin User (inline or modal edit)
  const updateAdminUser = (updatedUser: AdminUser, oldUser?: AdminUser) => {
    const previous = oldUser || adminUsers.find((u) => u.id === updatedUser.id);
    setAdminUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

    // Generate detailed Change Comparison Audit Log
    const changes: string[] = [];
    if (previous) {
      if (previous.name !== updatedUser.name) {
        changes.push(`Name changed from "${previous.name}" to "${updatedUser.name}"`);
      }
      if (previous.role !== updatedUser.role) {
        changes.push(`Role changed from "${previous.role}" to "${updatedUser.role}"`);
      }
      if (previous.phone !== updatedUser.phone) {
        changes.push(`Contact updated to "${updatedUser.phone}"`);
      }
      if (previous.designation !== updatedUser.designation) {
        changes.push(`Designation updated to "${updatedUser.designation}"`);
      }
      if (previous.status !== updatedUser.status) {
        changes.push(`Status changed from "${previous.status}" to "${updatedUser.status}"`);
      }

      const prevPerms = resolveUserPermissions(previous.role, previous.customPermissions);
      const nextPerms = resolveUserPermissions(updatedUser.role, updatedUser.customPermissions);

      addAuditLog({
        actorId: currentUser.id,
        actorName: `${currentUser.name} (${currentUser.role})`,
        targetUserId: updatedUser.id,
        targetUserName: updatedUser.name,
        actionType: previous.role !== updatedUser.role ? 'ROLE_CHANGE' : 'USER_UPDATE',
        description: changes.length > 0 ? changes.join('; ') : `Updated administrator profile for ${updatedUser.name}`,
        oldValue: previous.role,
        newValue: updatedUser.role,
        oldPermissions: prevPerms,
        newPermissions: nextPerms,
        status: 'SUCCESS',
      });
    }
  };

  // 9. Delete / Deactivate Admin User
  const deleteAdminUser = (userId: string): { success: boolean; message: string } => {
    const target = adminUsers.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: 'User not found.' };
    }

    // Safety rule: Cannot delete primary admin (headmaster)
    if (target.role === 'primary_admin') {
      return {
        success: false,
        message: 'Cannot delete the Primary Administrator / Headmaster account. Transfer primary role first.',
      };
    }

    // Ensure at least 1 admin remains
    const adminCount = adminUsers.filter((u) => u.role === 'primary_admin' || u.role === 'senior_admin').length;
    if (adminCount <= 1 && target.role === 'senior_admin') {
      return {
        success: false,
        message: 'Cannot delete the only remaining senior administrator in the school.',
      };
    }

    setAdminUsers((prev) => prev.filter((u) => u.id !== userId));

    addAuditLog({
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      targetUserId: target.id,
      targetUserName: target.name,
      actionType: 'USER_DELETE',
      description: `Removed administrative user account "${target.name}" (${target.role}, ${target.email})`,
      oldValue: `${target.name} [${target.role}]`,
      newValue: 'DELETED',
      status: 'SUCCESS',
    });

    return {
      success: true,
      message: `Administrator "${target.name}" was successfully removed from the system.`,
    };
  };

  // 10. Add New Admin User
  const addAdminUser = (newUser: Partial<AdminUser> & { name: string; email: string; role: AdminRoleType }) => {
    const id = `user-admin-${Date.now()}`;
    const userToAdd: AdminUser = {
      id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      designation: newUser.designation || `${newUser.role.replace('_', ' ').toUpperCase()}`,
      phone: newUser.phone || '+91 98000 00000',
      employeeId: newUser.employeeId || `ADM-${Math.floor(100 + Math.random() * 900)}`,
      avatar: newUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      lastActive: new Date().toISOString(),
      recentActions: ['Created administrative account', 'Completed security onboarding'],
      activity7Days: [5, 10, 8, 12, 14, 2, 4],
      inheritsFrom: newUser.role === 'senior_admin' ? 'junior_admin' : 'none',
      status: 'Active',
      customPermissions: newUser.customPermissions || {},
    };

    setAdminUsers((prev) => [...prev, userToAdd]);

    const perms = resolveUserPermissions(userToAdd.role, userToAdd.customPermissions);
    addAuditLog({
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      targetUserId: id,
      targetUserName: userToAdd.name,
      actionType: 'USER_CREATE',
      description: `Created new ${userToAdd.role.replace('_', ' ')} account for "${userToAdd.name}" (${userToAdd.email})`,
      newValue: userToAdd.role,
      newPermissions: perms,
      status: 'SUCCESS',
    });
  };

  const setCurrentUserById = (userId: string) => {
    setCurrentUserId(userId);
  };

  // 11. Purge Synced Data Utility
  const purgeSyncedData = (): { count: number; archivedData: string } => {
    const purgedCount = 42;
    const timestamp = new Date().toISOString();
    const archiveSnapshot = JSON.stringify({
      schoolUdise: '09240104502',
      purgedAt: timestamp,
      purgedBy: currentUser.name,
      purgedRecordCount: purgedCount,
      type: 'OFFLINE_SYNC_CACHE_PURGE_ARCHIVE',
      notice: 'Certified school offline record snapshot archived prior to 30-day cache sweep.',
    });

    addAuditLog({
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      actionType: 'DATA_PURGE',
      description: `Executed system hygiene utility: Purged ${purgedCount} synced offline attendance and marks cache records older than 30 days`,
      oldValue: `${purgedCount} records cached`,
      newValue: '0 cached records (>30 days)',
      status: 'SUCCESS',
    });

    return {
      count: purgedCount,
      archivedData: archiveSnapshot,
    };
  };

  return (
    <PermissionsContext.Provider
      value={{
        currentUser,
        adminUsers,
        currentRole: currentUser.role,
        effectiveRole,
        simulatedRole,
        setSimulatedRole,
        hasPermission,
        canAccessTab,
        securitySettings,
        updateSecuritySettings,
        auditLogs,
        addAuditLog,
        updateAdminUser,
        deleteAdminUser,
        addAdminUser,
        setCurrentUserById,
        purgeSyncedData,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
