// ---------------------------------------------------------------------------
// contexts/PermissionContext.tsx — Role-aware permission checks
//
// Wraps the permission engine with current user + current project context.
// Fetches the user's role from the project_members table.
//
// For the project owner (creator), the role is always 'owner' even if not
// in project_members. For non-authenticated users or local-only mode,
// the role defaults to 'owner' (full access to their own data).
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import {
  type Role,
  type Resource,
  canView,
  canEdit,
  canDelete,
  canInvite,
  canManageMembers,
  canDeleteProject,
  getAccessibleResources,
  getResourceForRoute,
  ROLE_LABELS,
} from '@/lib/permissions';

export const [PermissionProvider, usePermission] = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const { activeProjectId, activeProject } = useProjects();

  const [role, setRole] = useState<Role>('owner');
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  const userId = user?.id ?? null;

  // -----------------------------------------------------------------------
  // Fetch role when project or user changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !userId || !activeProjectId) {
      // Not authenticated or no project — default to owner (local-only mode)
      setRole('owner');
      return;
    }

    fetchRole(userId, activeProjectId);
  }, [isAuthenticated, userId, activeProjectId]);

  const fetchRole = useCallback(async (uid: string, projectId: string) => {
    setIsLoadingRole(true);
    try {
      // Check if user is the project creator (always owner)
      const { data: project } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .maybeSingle();

      if (project?.user_id === uid) {
        setRole('owner');
        setIsLoadingRole(false);
        return;
      }

      // Check project_members table
      const { data: membership } = await supabase
        .from('project_members')
        .select('role')
        .eq('user_id', uid)
        .eq('project_id', projectId)
        .not('accepted_at', 'is', null)
        .maybeSingle();

      if (membership?.role) {
        setRole(membership.role as Role);
      } else {
        // No membership found — could be a local-only project
        // Default to owner for backward compatibility
        setRole('owner');
      }
    } catch (e: any) {
      console.warn('[PermissionContext] Error fetching role:', e.message);
      setRole('owner'); // Fail-open for local-only usage
    } finally {
      setIsLoadingRole(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Memoized permission checks
  // -----------------------------------------------------------------------
  const checkView = useCallback((resource: Resource) => canView(role, resource), [role]);
  const checkEdit = useCallback((resource: Resource) => canEdit(role, resource), [role]);
  const checkDelete = useCallback((resource: Resource) => canDelete(role, resource), [role]);
  const checkInvite = useCallback(() => canInvite(role), [role]);
  const checkManageMembers = useCallback(() => canManageMembers(role), [role]);
  const checkDeleteProject = useCallback(() => canDeleteProject(role), [role]);

  const accessibleResources = useMemo(() => getAccessibleResources(role), [role]);

  const checkRouteAccess = useCallback((route: string): { canView: boolean; canEdit: boolean } => {
    const resource = getResourceForRoute(route);
    if (!resource) return { canView: true, canEdit: true }; // Unknown route — allow
    return { canView: canView(role, resource), canEdit: canEdit(role, resource) };
  }, [role]);

  const roleLabel = ROLE_LABELS[role];

  return {
    role,
    roleLabel,
    isLoadingRole,

    // Permission checks
    canView: checkView,
    canEdit: checkEdit,
    canDelete: checkDelete,
    canInvite: checkInvite,
    canManageMembers: checkManageMembers,
    canDeleteProject: checkDeleteProject,

    // Helpers
    accessibleResources,
    checkRouteAccess,
  };
});
