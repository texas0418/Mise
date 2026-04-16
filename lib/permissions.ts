// ---------------------------------------------------------------------------
// lib/permissions.ts — Role-based permission engine
//
// Roles are per-project. A user can be Director on one project and Crew on
// another. The permission matrix is a simple config that can be adjusted
// without code changes.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = 'owner' | 'director' | 'producer' | 'ad' | 'dp' | 'editor' | 'crew' | 'viewer';

export type AccessLevel = 'write' | 'read' | 'none';

export type Resource =
  | 'shots' | 'schedule' | 'budget' | 'crew' | 'cast'
  | 'locations' | 'script_sides' | 'continuity' | 'vfx'
  | 'festivals' | 'notes' | 'lookbook' | 'blocking'
  | 'color_refs' | 'time_entries' | 'wrap_reports'
  | 'call_sheets' | 'shot_refs' | 'mood_board' | 'selects'
  | 'messages' | 'script_breakdown' | 'digital_slate'
  | 'lens_calc' | 'frame_guides' | 'weather'
  | 'portfolio' | 'export' | 'shot_checklist'
  | 'director_statement' | 'credits';

export const ALL_ROLES: Role[] = ['owner', 'director', 'producer', 'ad', 'dp', 'editor', 'crew', 'viewer'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  director: 'Director',
  producer: 'Producer',
  ad: 'Assistant Director',
  dp: 'Cinematographer',
  editor: 'Editor',
  crew: 'Crew',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full access. Can delete project and manage all members.',
  director: 'Full creative access. Can invite members.',
  producer: 'Full production access. Read-only on director-specific tools.',
  ad: 'Schedule, call sheets, continuity, and on-set tools.',
  dp: 'Shots, references, lens tools, color/LUTs.',
  editor: 'Selects, VFX, wrap reports, notes.',
  crew: 'View-only on most tools. Can log time entries.',
  viewer: 'Read-only access to all tools.',
};

// ---------------------------------------------------------------------------
// Permission Matrix — which role gets which access to which resource
//
// 'write' = full CRUD
// 'read'  = view only
// 'none'  = hidden / no access
//
// If a resource isn't listed for a role, the default applies:
//   owner/director → 'write'
//   viewer → 'read'
//   others → 'none'
// ---------------------------------------------------------------------------

type RolePermissions = Partial<Record<Resource, AccessLevel>> & { _default?: AccessLevel };

const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  owner: {
    _default: 'write',
  },
  director: {
    _default: 'write',
  },
  producer: {
    _default: 'write',
    lookbook: 'read',
    director_statement: 'none',
  },
  ad: {
    _default: 'none',
    schedule: 'write',
    call_sheets: 'write',
    shot_checklist: 'write',
    continuity: 'write',
    blocking: 'write',
    digital_slate: 'write',
    time_entries: 'write',
    messages: 'write',
    notes: 'write',
    shots: 'read',
    crew: 'read',
    cast: 'read',
    locations: 'read',
    script_sides: 'read',
    script_breakdown: 'read',
    weather: 'read',
  },
  dp: {
    _default: 'none',
    shots: 'write',
    shot_refs: 'write',
    color_refs: 'write',
    lens_calc: 'write',
    frame_guides: 'write',
    mood_board: 'write',
    digital_slate: 'write',
    time_entries: 'write',
    shot_checklist: 'read',
    schedule: 'read',
    call_sheets: 'read',
    locations: 'read',
    weather: 'read',
    blocking: 'read',
    notes: 'read',
  },
  editor: {
    _default: 'none',
    selects: 'write',
    vfx: 'write',
    notes: 'write',
    time_entries: 'write',
    wrap_reports: 'read',
    shots: 'read',
    shot_refs: 'read',
    color_refs: 'read',
    continuity: 'read',
    script_sides: 'read',
    script_breakdown: 'read',
  },
  crew: {
    _default: 'read',
    time_entries: 'write',
    messages: 'read',
    lookbook: 'none',
    director_statement: 'none',
    credits: 'none',
    budget: 'none',
    festivals: 'none',
    vfx: 'none',
  },
  viewer: {
    _default: 'read',
    director_statement: 'none',
  },
};

// ---------------------------------------------------------------------------
// Permission check functions
// ---------------------------------------------------------------------------

function getAccessLevel(role: Role, resource: Resource): AccessLevel {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return 'none';

  // Check explicit resource permission first
  const explicit = perms[resource];
  if (explicit !== undefined) return explicit;

  // Fall back to default for this role
  return perms._default || 'none';
}

export function canView(role: Role, resource: Resource): boolean {
  const level = getAccessLevel(role, resource);
  return level === 'read' || level === 'write';
}

export function canEdit(role: Role, resource: Resource): boolean {
  return getAccessLevel(role, resource) === 'write';
}

export function canDelete(role: Role, resource: Resource): boolean {
  // Only write access roles can delete. Owner/Director can always delete.
  if (role === 'owner' || role === 'director') return true;
  return getAccessLevel(role, resource) === 'write';
}

export function canInvite(role: Role): boolean {
  return role === 'owner' || role === 'director';
}

export function canManageMembers(role: Role): boolean {
  return role === 'owner' || role === 'director';
}

export function canDeleteProject(role: Role): boolean {
  return role === 'owner';
}

export function getAccessibleResources(role: Role): Resource[] {
  const all: Resource[] = [
    'shots', 'schedule', 'budget', 'crew', 'cast', 'locations',
    'script_sides', 'continuity', 'vfx', 'festivals', 'notes',
    'lookbook', 'blocking', 'color_refs', 'time_entries', 'wrap_reports',
    'call_sheets', 'shot_refs', 'mood_board', 'selects', 'messages',
    'script_breakdown', 'digital_slate', 'lens_calc', 'frame_guides',
    'weather', 'portfolio', 'export', 'shot_checklist',
    'director_statement', 'credits',
  ];
  return all.filter(r => canView(role, r));
}

// ---------------------------------------------------------------------------
// Route → Resource mapping (for gating tool screens)
// ---------------------------------------------------------------------------

export const ROUTE_TO_RESOURCE: Record<string, Resource> = {
  '/shots': 'shots',
  '/shot-checklist': 'shot_checklist',
  '/script-sides': 'script_sides',
  '/cast-manager': 'cast',
  '/lookbook': 'lookbook',
  '/script-breakdown': 'script_breakdown',
  '/locations': 'locations',
  '/budget': 'budget',
  '/call-sheets': 'call_sheets',
  '/mood-boards': 'mood_board',
  '/crew-directory': 'crew',
  '/shot-references': 'shot_refs',
  '/blocking-notes': 'blocking',
  '/color-references': 'color_refs',
  '/location-weather': 'weather',
  '/digital-slate': 'digital_slate',
  '/continuity': 'continuity',
  '/production-notes': 'notes',
  '/time-tracker': 'time_entries',
  '/selects': 'selects',
  '/comms-hub': 'messages',
  '/vfx-tracker': 'vfx',
  '/festival-tracker': 'festivals',
  '/wrap-reports': 'wrap_reports',
  '/lens-calculator': 'lens_calc',
  '/portfolio': 'portfolio',
  '/frame-guides': 'frame_guides',
  '/export-share': 'export',
};

export function getResourceForRoute(route: string): Resource | null {
  return ROUTE_TO_RESOURCE[route] || null;
}
