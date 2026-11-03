// ---------------------------------------------------------------------------
// contexts/PermissionContext.tsx: role-aware permission checks
//
// Wraps the permission engine with current user + current project context.
// Fetches the user's role from the project_members table.
//
// The project's creator is always 'owner'. A project that exists only on this
// device (never synced, or signed out) is the user's own, so it is 'owner'
// too. A project someone else owns gets the member's role, and 'viewer' when
// that cannot be read: this used to fail open to 'owner', which showed crew a
// Delete button for the director's film whenever the lookup errored.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import { appAlert } from '@/lib/appAlert';
import { ensureUUID } from '@/lib/syncIds';
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
  // Accepted roles by server project id, for screens that list many projects.
  const [memberRoles, setMemberRoles] = useState<Record<string, Role>>({});

  const userId = user?.id ?? null;
  const activeOwnerId = activeProject?.userId ?? null;

  // -----------------------------------------------------------------------
  // Fetch role when project or user changes
  // -----------------------------------------------------------------------
  const fetchRole = useCallback(async (uid: string, projectId: string, localOwnerId: string | null) => {
    setIsLoadingRole(true);
    setRole(await resolveRole(uid, projectId, localOwnerId));
    setIsLoadingRole(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId || !activeProjectId) {
      // Not authenticated or no project: local-only mode, the user's own data
      setRole('owner');
      return;
    }
    fetchRole(userId, activeProjectId, activeOwnerId);
  }, [isAuthenticated, userId, activeProjectId, activeOwnerId, fetchRole]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setMemberRoles({});
      return;
    }
    void fetchMemberRoles(userId).then(setMemberRoles);
  }, [isAuthenticated, userId, activeProjectId]);

  /** The role this user holds on any project, for list screens. */
  const roleForProject = useCallback((project: { id: string; userId?: string } | null | undefined): Role => {
    if (!project) return 'viewer';
    if (!isAuthenticated || !userId) return 'owner';
    if (!project.userId || project.userId === userId) return 'owner';
    const serverId = ensureUUID(project.id);
    return (serverId && memberRoles[serverId]) || 'viewer';
  }, [isAuthenticated, userId, memberRoles]);

  // -----------------------------------------------------------------------
  // Memoized permission checks
  // -----------------------------------------------------------------------
  const checkView = useCallback((resource: Resource) => canView(role, resource), [role]);
  const checkEdit = useCallback((resource: Resource) => canEdit(role, resource), [role]);
  const checkDelete = useCallback((resource: Resource) => canDelete(role, resource), [role]);
  const checkInvite = useCallback(() => canInvite(role), [role]);
  const checkManageMembers = useCallback(() => canManageMembers(role), [role]);
  const checkDeleteProject = useCallback(() => canDeleteProject(role), [role]);
  const checkDeleteProjectFor = useCallback(
    (project: { id: string; userId?: string } | null | undefined) => canDeleteProject(roleForProject(project)),
    [roleForProject],
  );

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
    canDeleteProjectFor: checkDeleteProjectFor,
    roleForProject,

    // Helpers
    accessibleResources,
    checkRouteAccess,
  };
});

/**
 * The user's role on one project.
 *
 * Owner when the server says they created it, or when the server has no such
 * project (it lives only on this device). Otherwise their accepted membership
 * role, and viewer when there is none or the lookup fails, unless the local
 * copy says this user created it.
 */
async function resolveRole(uid: string, projectId: string, localOwnerId: string | null): Promise<Role> {
  const fallback: Role = !localOwnerId || localOwnerId === uid ? 'owner' : 'viewer';
  const serverId = ensureUUID(projectId);
  if (!serverId) return fallback;
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', serverId)
      .maybeSingle();
    if (error) throw error;
    if (!project) return fallback;
    if (project.user_id === uid) return 'owner';

    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('user_id', uid)
      .eq('project_id', serverId)
      .not('accepted_at', 'is', null)
      .is('deleted_at', null)
      .maybeSingle();
    if (memberError) throw memberError;
    return (membership?.role as Role) || 'viewer';
  } catch (e: any) {
    console.warn('[PermissionContext] Error fetching role:', e.message);
    return fallback;
  }
}

async function fetchMemberRoles(uid: string): Promise<Record<string, Role>> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', uid)
      .not('accepted_at', 'is', null)
      .is('deleted_at', null);
    if (error) throw error;
    const out: Record<string, Role> = {};
    for (const row of data ?? []) out[row.project_id] = row.role as Role;
    return out;
  } catch (e: any) {
    console.warn('[PermissionContext] Error fetching memberships:', e.message);
    return {};
  }
}

/**
 * Wrap a store's delete so it does nothing but explain itself when the role
 * cannot delete this kind of record. The server enforces the same rule on the
 * soft delete (supabase/migrations/20261103_soft_delete_needs_delete_right.sql);
 * this keeps the phone from removing the record locally first and then
 * silently getting it back on the next pull.
 */
export function useGuardedDelete<A extends unknown[]>(
  resource: Resource,
  remove: (...args: A) => void,
): (...args: A) => void {
  const { canDelete: allowed, roleLabel } = usePermission();
  return useCallback((...args: A) => {
    if (!allowed(resource)) {
      appAlert('Not Allowed', `Your role (${roleLabel}) can't delete this. Ask the project owner or director.`);
      return;
    }
    remove(...args);
  }, [allowed, resource, roleLabel, remove]);
}
