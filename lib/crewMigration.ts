// ---------------------------------------------------------------------------
// lib/crewMigration.ts — Give existing crew a project
//
// Crew used to be global: every contact ever entered showed on every project's
// directory and every call sheet (#40). Contacts stay global — a director
// reuses the same gaffer — and CrewAssignment now says who is on which film.
//
// The problem this solves is that existing installs have contacts and no
// assignments, so without a backfill their call sheets would go from listing
// everyone to listing nobody. There is no record of which film an old contact
// belonged to, and guessing would silently drop people from a call sheet.
//
// So it assigns every existing contact to every existing project: exactly the
// behaviour those users see today, nothing lost, and now unassignable one at a
// time. Runs once, and only for contacts that predate assignments.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrewMember, CrewAssignment, Project } from '@/types';

const MIGRATION_KEY = 'mise_crew_migration_v1';
const CREW_KEY = 'mise_crew';
const ASSIGNMENTS_KEY = 'mise_crew_assignments';
const PROJECTS_KEY = 'mise_projects';

export interface CrewMigrationResult {
  /** Assignments created. */
  created: number;
}

export async function hasRunCrewMigration(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === 'done';
  } catch {
    return false;
  }
}

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function runCrewMigration(): Promise<CrewMigrationResult> {
  const result: CrewMigrationResult = { created: 0 };

  const [crew, projects, existing] = await Promise.all([
    readArray<CrewMember>(CREW_KEY),
    readArray<Project>(PROJECTS_KEY),
    readArray<CrewAssignment>(ASSIGNMENTS_KEY),
  ]);

  if (crew.length === 0 || projects.length === 0) {
    try { await AsyncStorage.setItem(MIGRATION_KEY, 'done'); } catch {}
    return result;
  }

  const already = new Set(existing.map(a => `${a.projectId}::${a.crewMemberId}`));
  const stamp = new Date().toISOString();
  const added: CrewAssignment[] = [];

  for (const project of projects) {
    for (const person of crew) {
      const key = `${project.id}::${person.id}`;
      if (already.has(key)) continue;
      already.add(key);
      added.push({
        id: `assign-${project.id}-${person.id}`,
        projectId: project.id,
        crewMemberId: person.id,
        // Role comes from the contact until someone changes it for this film,
        // and call time stays empty so they sit on the general call — which is
        // what every call sheet printed before.
        createdAt: stamp,
      });
    }
  }

  if (added.length > 0) {
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify([...existing, ...added]));
    result.created = added.length;
  }

  try { await AsyncStorage.setItem(MIGRATION_KEY, 'done'); } catch {}
  return result;
}
