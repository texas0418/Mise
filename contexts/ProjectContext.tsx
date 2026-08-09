import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  Project, Shot, ScheduleDay, CrewMember, Take, SceneBreakdown,
  LocationScout, BudgetItem, ContinuityNote, VFXShot, FestivalSubmission,
  ProductionNote, MoodBoardItem, DirectorCredit, ShotReference, WrapReport,
  LocationWeather, BlockingNote, ColorReference, TimeEntry, ScriptSide,
  CastMember, LookbookItem, DirectorStatement, SceneSelect, DirectorMessage,
  ScriptPDF, ScriptAnnotation, LightingDiagram, Scene, CrewAssignment, CastCallTime, CallSheetDetails
} from '@/types';
import { useSync } from '@/contexts/SyncContext';
import { compareSceneNumbers } from '@/utils/eighths';
import { castTimesForDay } from '@/utils/callSheet';

const STORAGE_KEYS = {
  projects: 'mise_projects',
  shots: 'mise_shots',
  schedule: 'mise_schedule',
  crew: 'mise_crew',
  crewAssignments: 'mise_crew_assignments',
  takes: 'mise_takes',
  activeProject: 'mise_active_project',
  scenes: 'mise_scenes',
  sceneBreakdowns: 'mise_scene_breakdowns',
  locations: 'mise_locations',
  budget: 'mise_budget',
  continuity: 'mise_continuity',
  vfx: 'mise_vfx',
  festivals: 'mise_festivals',
  notes: 'mise_notes',
  moodBoard: 'mise_mood_board',
  credits: 'mise_credits',
  shotReferences: 'mise_shot_references',
  wrapReports: 'mise_wrap_reports',
  locationWeather: 'mise_location_weather',
  blockingNotes: 'mise_blocking_notes',
  colorReferences: 'mise_color_references',
  timeEntries: 'mise_time_entries',
  scriptSides: 'mise_script_sides',
  cast: 'mise_cast',
  castCallTimes: 'mise_cast_call_times',
  callSheetDetails: 'mise_call_sheet_details',
  lookbook: 'mise_lookbook',
  directorStatement: 'mise_director_statement',
  selects: 'mise_selects',
  messages: 'mise_messages',
  scriptPDFs: 'mise_script_pdfs',
  scriptAnnotations: 'mise_script_annotations',
  lightingDiagrams: 'mise_lighting_diagrams',
};

// Reading never writes. This previously persisted its fallback on a storage
// miss, which is the mechanism that seeded fictional sample records into real
// user storage before the user had tapped anything (#35).
async function loadFromStorage<T>(key: string, fallback: T[]): Promise<T[]> {
  const safeFallback = fallback ?? ([] as T[]);
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
      await AsyncStorage.removeItem(key);
    }
    return safeFallback;
  } catch (e) {
    console.log('Storage load error:', e);
    try { await AsyncStorage.removeItem(key); } catch (_) {}
    return safeFallback;
  }
}

async function saveToStorage<T>(key: string, data: T[]): Promise<T[]> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return data;
  } catch (e) {
    console.log('Storage save error:', e);
    return data;
  }
}

// ---------------------------------------------------------------------------
// Serialized writes
//
// Each storage key owns a promise chain. Every mutation runs as a step on that
// chain and reads its base state *inside* the step, so two mutations issued in
// the same tick see each other's result instead of both deriving from the same
// stale render snapshot and the second silently discarding the first.
// The chain also guarantees the underlying setItem calls land in issue order.
// ---------------------------------------------------------------------------
const writeChains = new Map<string, Promise<void>>();

function serializeWrite(storageKey: string, step: () => Promise<void>): Promise<void> {
  const previous = writeChains.get(storageKey) ?? Promise.resolve();
  const next = previous.then(step);
  // Store a settled-either-way handle so one failed step can't stall the chain.
  writeChains.set(storageKey, next.catch(() => undefined));
  return next;
}

type EnqueueMutation = (
  table: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  data: Record<string, any> | null,
) => Promise<void>;

// ---------------------------------------------------------------------------
// useEntityStore — now accepts supabaseTable to enqueue mutations for sync.
// The enqueueMutation function is passed in so this hook doesn't call useSync
// directly (useSync is called once in the parent createContextHook).
// ---------------------------------------------------------------------------
function useEntityStore<T extends { id: string }>(
  queryKey: string,
  storageKey: string,
  fallback: T[],
  supabaseTable: string,
  enqueueMutation: EnqueueMutation,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => loadFromStorage<T>(storageKey, fallback),
    // This store is the only writer of its storage key, so the cache is
    // authoritative once loaded. Without this, every mutation re-reads
    // AsyncStorage and a focus refetch can briefly revert an optimistic write.
    // The sync engine still calls invalidateQueries after a remote pull.
    staleTime: Infinity,
  });

  // Apply `updater` to the freshest known list, persist it, then enqueue the
  // matching sync operations. Returns a promise callers may ignore.
  const mutate = useCallback((
    updater: (prev: T[]) => T[],
    sync: (next: T[]) => Promise<void>,
  ) => serializeWrite(storageKey, async () => {
    // ensureQueryData resolves from cache when loaded and awaits the initial
    // storage read otherwise, so a mutation fired during startup can't write
    // an empty list over real data.
    const prev = await queryClient.ensureQueryData<T[]>({
      queryKey: [queryKey],
      queryFn: () => loadFromStorage<T>(storageKey, fallback),
    });
    const next = updater(prev);
    queryClient.setQueryData([queryKey], next);
    await saveToStorage(storageKey, next);
    await sync(next);
  }), [queryClient, queryKey, storageKey, fallback]);

  const add = useCallback((item: T) => {
    void mutate(
      prev => [...prev, item],
      () => enqueueMutation(supabaseTable, item.id, 'insert', item as any),
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  const addBulk = useCallback((newItems: T[]) => {
    if (newItems.length === 0) return;
    void mutate(
      prev => [...prev, ...newItems],
      async () => {
        // Enqueue each item individually for sync
        for (const item of newItems) {
          await enqueueMutation(supabaseTable, item.id, 'insert', item as any);
        }
      },
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  const update = useCallback((item: T) => {
    void mutate(
      prev => prev.map(i => i.id === item.id ? item : i),
      () => enqueueMutation(supabaseTable, item.id, 'update', item as any),
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  // Single write for a batch of edits. Callers that would otherwise loop over
  // `update` should use this — one persisted array instead of N.
  const updateMany = useCallback((updatedItems: T[]) => {
    if (updatedItems.length === 0) return;
    void mutate(
      prev => {
        const byId = new Map(updatedItems.map(i => [i.id, i]));
        return prev.map(i => byId.get(i.id) ?? i);
      },
      async () => {
        for (const item of updatedItems) {
          await enqueueMutation(supabaseTable, item.id, 'update', item as any);
        }
      },
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  const remove = useCallback((id: string) => {
    void mutate(
      prev => prev.filter(i => i.id !== id),
      () => enqueueMutation(supabaseTable, id, 'delete', null),
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  // Remove every record matching a predicate, in one write.
  //
  // The removed items are captured inside the updater, which runs immediately
  // before the sync step within the same serialized write, so the ids enqueued
  // are exactly the ones that went. Filtering the render snapshot instead would
  // miss anything added since it was taken.
  const removeWhere = useCallback((predicate: (item: T) => boolean) => {
    let removed: T[] = [];
    return mutate(
      prev => {
        removed = prev.filter(predicate);
        if (removed.length === 0) return prev;
        return prev.filter(i => !predicate(i));
      },
      async () => {
        for (const item of removed) {
          await enqueueMutation(supabaseTable, item.id, 'delete', null);
        }
      },
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  // Create-or-edit in one serialized step.
  //
  // The match runs *inside* the write chain, against the freshest list, which
  // is the whole point: deciding "does a row exist yet" from a render snapshot
  // means two keystrokes in the same tick both decide "no" and both insert.
  // That is #33 again, and here it would also breach the unique constraint on
  // (schedule_day_id, cast_member_id) the moment it reached Supabase.
  const upsert = useCallback((
    match: (item: T) => boolean,
    build: (existing: T | null) => T,
  ) => {
    void mutate(
      prev => {
        const index = prev.findIndex(match);
        if (index === -1) return [...prev, build(null)];
        const next = [...prev];
        next[index] = build(next[index]);
        return next;
      },
      async next => {
        const item = next.find(match);
        // 'update' rather than 'insert': pushSingleItem upserts on id either
        // way, and this call cannot know which one it turned out to be.
        if (item) await enqueueMutation(supabaseTable, item.id, 'update', item as any);
      },
    );
  }, [mutate, enqueueMutation, supabaseTable]);

  return { items: query.data ?? [], add, addBulk, update, updateMany, remove, removeWhere, upsert, isLoading: query.isLoading };
}

export const [ProjectProvider, useProjects] = createContextHook(() => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Get enqueueMutation from SyncContext — if sync is disabled, this is a no-op
  const { enqueueMutation } = useSync();

  const projectStore = useEntityStore<Project>('projects', STORAGE_KEYS.projects, [], 'projects', enqueueMutation);
  const shotStore = useEntityStore<Shot>('shots', STORAGE_KEYS.shots, [], 'shots', enqueueMutation);
  const scheduleStore = useEntityStore<ScheduleDay>('schedule', STORAGE_KEYS.schedule, [], 'schedule_days', enqueueMutation);
  const crewStore = useEntityStore<CrewMember>('crew', STORAGE_KEYS.crew, [], 'crew_members', enqueueMutation);
  const crewAssignmentStore = useEntityStore<CrewAssignment>('crewAssignments', STORAGE_KEYS.crewAssignments, [], 'crew_assignments', enqueueMutation);
  const takeStore = useEntityStore<Take>('takes', STORAGE_KEYS.takes, [], 'takes', enqueueMutation);
  const sceneStore = useEntityStore<Scene>('scenes', STORAGE_KEYS.scenes, [], 'scenes', enqueueMutation);
  const breakdownStore = useEntityStore<SceneBreakdown>('sceneBreakdowns', STORAGE_KEYS.sceneBreakdowns, [], 'scene_breakdowns', enqueueMutation);
  const locationStore = useEntityStore<LocationScout>('locations', STORAGE_KEYS.locations, [], 'location_scouts', enqueueMutation);
  const budgetStore = useEntityStore<BudgetItem>('budget', STORAGE_KEYS.budget, [], 'budget_items', enqueueMutation);
  const continuityStore = useEntityStore<ContinuityNote>('continuity', STORAGE_KEYS.continuity, [], 'continuity_notes', enqueueMutation);
  const vfxStore = useEntityStore<VFXShot>('vfx', STORAGE_KEYS.vfx, [], 'vfx_shots', enqueueMutation);
  const festivalStore = useEntityStore<FestivalSubmission>('festivals', STORAGE_KEYS.festivals, [], 'festival_submissions', enqueueMutation);
  const noteStore = useEntityStore<ProductionNote>('notes', STORAGE_KEYS.notes, [], 'production_notes', enqueueMutation);
  const moodBoardStore = useEntityStore<MoodBoardItem>('moodBoard', STORAGE_KEYS.moodBoard, [], 'mood_board_items', enqueueMutation);
  const creditStore = useEntityStore<DirectorCredit>('credits', STORAGE_KEYS.credits, [], 'director_credits', enqueueMutation);
  const shotRefStore = useEntityStore<ShotReference>('shotReferences', STORAGE_KEYS.shotReferences, [], 'shot_references', enqueueMutation);
  const wrapReportStore = useEntityStore<WrapReport>('wrapReports', STORAGE_KEYS.wrapReports, [], 'wrap_reports', enqueueMutation);
  const locationWeatherStore = useEntityStore<LocationWeather>('locationWeather', STORAGE_KEYS.locationWeather, [], 'location_weather', enqueueMutation);
  const blockingStore = useEntityStore<BlockingNote>('blockingNotes', STORAGE_KEYS.blockingNotes, [], 'blocking_notes', enqueueMutation);
  const colorRefStore = useEntityStore<ColorReference>('colorReferences', STORAGE_KEYS.colorReferences, [], 'color_references', enqueueMutation);
  const timeEntryStore = useEntityStore<TimeEntry>('timeEntries', STORAGE_KEYS.timeEntries, [], 'time_entries', enqueueMutation);
  const scriptSideStore = useEntityStore<ScriptSide>('scriptSides', STORAGE_KEYS.scriptSides, [], 'script_sides', enqueueMutation);
  const castStore = useEntityStore<CastMember>('cast', STORAGE_KEYS.cast, [], 'cast_members', enqueueMutation);
  const castCallTimeStore = useEntityStore<CastCallTime>('castCallTimes', STORAGE_KEYS.castCallTimes, [], 'cast_call_times', enqueueMutation);
  const callSheetDetailStore = useEntityStore<CallSheetDetails>('callSheetDetails', STORAGE_KEYS.callSheetDetails, [], 'call_sheet_details', enqueueMutation);
  const lookbookStore = useEntityStore<LookbookItem>('lookbook', STORAGE_KEYS.lookbook, [], 'lookbook_items', enqueueMutation);
  const directorStatementStore = useEntityStore<DirectorStatement>('directorStatement', STORAGE_KEYS.directorStatement, [], 'director_statements', enqueueMutation);
  const selectStore = useEntityStore<SceneSelect>('selects', STORAGE_KEYS.selects, [], 'scene_selects', enqueueMutation);
  const messageStore = useEntityStore<DirectorMessage>('messages', STORAGE_KEYS.messages, [], 'director_messages', enqueueMutation);
  const scriptPDFStore = useEntityStore<ScriptPDF>('scriptPDFs', STORAGE_KEYS.scriptPDFs, [], 'script_pdfs', enqueueMutation);
  const scriptAnnotationStore = useEntityStore<ScriptAnnotation>('scriptAnnotations', STORAGE_KEYS.scriptAnnotations, [], 'script_annotations', enqueueMutation);
  const lightingDiagramStore = useEntityStore<LightingDiagram>('lightingDiagrams', STORAGE_KEYS.lightingDiagrams, [], 'lighting_diagrams', enqueueMutation);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.activeProject).then((id) => {
      if (id) setActiveProjectId(id);
    });
  }, []);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    AsyncStorage.setItem(STORAGE_KEYS.activeProject, id);
  }, []);

  const projects = projectStore.items;
  const shots = shotStore.items;
  const schedule = scheduleStore.items;
  const crew = crewStore.items;
  const crewAssignments = crewAssignmentStore.items;
  const takes = takeStore.items;
  const scenes = sceneStore.items;
  const sceneBreakdowns = breakdownStore.items;
  const locations = locationStore.items;
  const budgetItems = budgetStore.items;
  const continuityNotes = continuityStore.items;
  const vfxShots = vfxStore.items;
  const festivals = festivalStore.items;
  const productionNotes = noteStore.items;
  const moodBoardItems = moodBoardStore.items;
  const directorCredits = creditStore.items;
  const shotReferences = shotRefStore.items;
  const wrapReports = wrapReportStore.items;
  const locationWeather = locationWeatherStore.items;
  const blockingNotes = blockingStore.items;
  const colorReferences = colorRefStore.items;
  const timeEntries = timeEntryStore.items;
  const scriptSides = scriptSideStore.items;
  const castMembers = castStore.items;
  const castCallTimes = castCallTimeStore.items;
  const callSheetDetails = callSheetDetailStore.items;
  const lookbookItems = lookbookStore.items;
  const directorStatements = directorStatementStore.items;
  const sceneSelects = selectStore.items;
  const directorMessages = messageStore.items;
  const scriptPDFs = scriptPDFStore.items;
  const scriptAnnotations = scriptAnnotationStore.items;
  const lightingDiagrams = lightingDiagramStore.items;

  /**
   * Delete a project and everything belonging to it.
   *
   * `deleteProject` used to remove the project row alone, leaving every shot,
   * day, take and note behind permanently — storage grew without bound, every
   * `useProjectX` filter walked dead records forever, and the rows stayed alive
   * server-side. The confirmation said "this cannot be undone" while the data
   * was in fact still there (#46).
   *
   * The store list is written out rather than derived, because getting it wrong
   * is silent: a store left out leaves its rows behind forever. `crew` and
   * `credits` are deliberately absent — contacts and portfolio credits are
   * global and outlive any one film.
   *
   * Not wrapped in useCallback: the context object is rebuilt every render
   * regardless, so a stable identity here would buy nothing and the store list
   * would have to be a dependency of itself.
   */
  const deleteProject = (projectId: string) => {
    const belongsToProject = (item: { projectId?: string }) => item.projectId === projectId;

    // Location weather hangs off locations rather than the project, so its
    // parents have to be resolved before those locations are removed.
    const locationIds = new Set(
      locationStore.items.filter(l => l.projectId === projectId).map(l => l.id),
    );
    if (locationIds.size > 0) {
      void locationWeatherStore.removeWhere(w => locationIds.has(w.locationId));
    }

    void shotStore.removeWhere(belongsToProject);
    void scheduleStore.removeWhere(belongsToProject);
    void crewAssignmentStore.removeWhere(belongsToProject);
    void takeStore.removeWhere(belongsToProject);
    void sceneStore.removeWhere(belongsToProject);
    void breakdownStore.removeWhere(belongsToProject);
    void locationStore.removeWhere(belongsToProject);
    void budgetStore.removeWhere(belongsToProject);
    void continuityStore.removeWhere(belongsToProject);
    void vfxStore.removeWhere(belongsToProject);
    void festivalStore.removeWhere(belongsToProject);
    void noteStore.removeWhere(belongsToProject);
    void moodBoardStore.removeWhere(belongsToProject);
    void shotRefStore.removeWhere(belongsToProject);
    void wrapReportStore.removeWhere(belongsToProject);
    void blockingStore.removeWhere(belongsToProject);
    void colorRefStore.removeWhere(belongsToProject);
    void timeEntryStore.removeWhere(belongsToProject);
    void scriptSideStore.removeWhere(belongsToProject);
    void castStore.removeWhere(belongsToProject);
    void castCallTimeStore.removeWhere(belongsToProject);
    void callSheetDetailStore.removeWhere(belongsToProject);
    void lookbookStore.removeWhere(belongsToProject);
    void directorStatementStore.removeWhere(belongsToProject);
    void selectStore.removeWhere(belongsToProject);
    void messageStore.removeWhere(belongsToProject);
    void scriptPDFStore.removeWhere(belongsToProject);
    void scriptAnnotationStore.removeWhere(belongsToProject);
    void lightingDiagramStore.removeWhere(belongsToProject);

    // The project goes last. If anything above fails, the film is still listed
    // and the delete can be retried, rather than vanishing and stranding
    // whatever was left behind.
    void projectStore.remove(projectId);
  };

  /** Put a film away without destroying it, and bring it back. */
  const archiveProject = (projectId: string) => {
    const project = projectStore.items.find(p => p.id === projectId);
    if (project) projectStore.update({ ...project, archivedAt: new Date().toISOString() });
  };

  const restoreProject = (projectId: string) => {
    const project = projectStore.items.find(p => p.id === projectId);
    if (project) projectStore.update({ ...project, archivedAt: undefined });
  };

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const isLoading = projectStore.isLoading || shotStore.isLoading || scheduleStore.isLoading || crewStore.isLoading || takeStore.isLoading;

  return {
    projects, shots, schedule, crew, crewAssignments, takes, scenes, sceneBreakdowns, locations,
    budgetItems, continuityNotes, vfxShots, festivals, productionNotes,
    moodBoardItems, directorCredits, shotReferences, wrapReports,
    locationWeather, blockingNotes, colorReferences, timeEntries,
    scriptSides, castMembers, castCallTimes, callSheetDetails, lookbookItems, directorStatements,
    sceneSelects, directorMessages, scriptPDFs, scriptAnnotations,
    lightingDiagrams,
    activeProject, activeProjectId,
    isLoading, selectProject,

    addProject: projectStore.add, updateProject: projectStore.update, deleteProject,
    archiveProject, restoreProject,
    addShot: shotStore.add, updateShot: shotStore.update, updateShots: shotStore.updateMany, deleteShot: shotStore.remove,
    addScheduleDay: scheduleStore.add, updateScheduleDay: scheduleStore.update, deleteScheduleDay: scheduleStore.remove,
    addCrewMember: crewStore.add, updateCrewMember: crewStore.update, deleteCrewMember: crewStore.remove,
    addCrewAssignment: crewAssignmentStore.add, updateCrewAssignment: crewAssignmentStore.update, deleteCrewAssignment: crewAssignmentStore.remove,
    addCrewAssignmentBulk: crewAssignmentStore.addBulk,
    addTake: takeStore.add, updateTake: takeStore.update, deleteTake: takeStore.remove,
    addScene: sceneStore.add, updateScene: sceneStore.update, deleteScene: sceneStore.remove,
    addSceneBulk: sceneStore.addBulk,
    addBreakdown: breakdownStore.add, updateBreakdown: breakdownStore.update, deleteBreakdown: breakdownStore.remove,
    addLocation: locationStore.add, updateLocation: locationStore.update, deleteLocation: locationStore.remove,
    addBudgetItem: budgetStore.add, updateBudgetItem: budgetStore.update, deleteBudgetItem: budgetStore.remove,
    addContinuityNote: continuityStore.add, updateContinuityNote: continuityStore.update, deleteContinuityNote: continuityStore.remove,
    addVFXShot: vfxStore.add, updateVFXShot: vfxStore.update, deleteVFXShot: vfxStore.remove,
    addFestival: festivalStore.add, updateFestival: festivalStore.update, deleteFestival: festivalStore.remove,
    addNote: noteStore.add, updateNote: noteStore.update, deleteNote: noteStore.remove,
    addMoodBoardItem: moodBoardStore.add, updateMoodBoardItem: moodBoardStore.update, deleteMoodBoardItem: moodBoardStore.remove,
    addCredit: creditStore.add, updateCredit: creditStore.update, deleteCredit: creditStore.remove,
    addShotReference: shotRefStore.add, updateShotReference: shotRefStore.update, deleteShotReference: shotRefStore.remove,
    addWrapReport: wrapReportStore.add, updateWrapReport: wrapReportStore.update, deleteWrapReport: wrapReportStore.remove,
    addLocationWeather: locationWeatherStore.add, updateLocationWeather: locationWeatherStore.update, deleteLocationWeather: locationWeatherStore.remove,
    addBlockingNote: blockingStore.add, updateBlockingNote: blockingStore.update, deleteBlockingNote: blockingStore.remove,
    addColorReference: colorRefStore.add, updateColorReference: colorRefStore.update, deleteColorReference: colorRefStore.remove,
    addTimeEntry: timeEntryStore.add, updateTimeEntry: timeEntryStore.update, deleteTimeEntry: timeEntryStore.remove,
    addScriptSide: scriptSideStore.add, updateScriptSide: scriptSideStore.update, deleteScriptSide: scriptSideStore.remove,
    addCastMember: castStore.add, updateCastMember: castStore.update, deleteCastMember: castStore.remove,
    addCastCallTime: castCallTimeStore.add, updateCastCallTime: castCallTimeStore.update, deleteCastCallTime: castCallTimeStore.remove,
    upsertCastCallTime: castCallTimeStore.upsert,
    upsertCallSheetDetails: callSheetDetailStore.upsert,
    addLookbookItem: lookbookStore.add, updateLookbookItem: lookbookStore.update, deleteLookbookItem: lookbookStore.remove,
    addDirectorStatement: directorStatementStore.add, updateDirectorStatement: directorStatementStore.update, deleteDirectorStatement: directorStatementStore.remove,
    addSceneSelect: selectStore.add, updateSceneSelect: selectStore.update, deleteSceneSelect: selectStore.remove,
    addMessage: messageStore.add, updateMessage: messageStore.update, deleteMessage: messageStore.remove,

    // Script PDFs + Annotations
    addScriptPDF: scriptPDFStore.add, updateScriptPDF: scriptPDFStore.update, deleteScriptPDF: scriptPDFStore.remove,
    addScriptAnnotation: scriptAnnotationStore.add, updateScriptAnnotation: scriptAnnotationStore.update, deleteScriptAnnotation: scriptAnnotationStore.remove,

    // Lighting Diagrams
    addLightingDiagram: lightingDiagramStore.add, updateLightingDiagram: lightingDiagramStore.update, deleteLightingDiagram: lightingDiagramStore.remove,

    // Bulk import methods
    addCrewMemberBulk: crewStore.addBulk,
    addShotBulk: shotStore.addBulk,
    addScheduleDayBulk: scheduleStore.addBulk,
    addBudgetItemBulk: budgetStore.addBulk,
    addLocationBulk: locationStore.addBulk,
    addBreakdownBulk: breakdownStore.addBulk,
    addCastMemberBulk: castStore.addBulk,
    addVFXShotBulk: vfxStore.addBulk,
    addFestivalBulk: festivalStore.addBulk,
    addTimeEntryBulk: timeEntryStore.addBulk,
    addScriptSideBulk: scriptSideStore.addBulk,
    addContinuityNoteBulk: continuityStore.addBulk,
    addWrapReportBulk: wrapReportStore.addBulk,
  };
});

// ---------------------------------------------------------------------------
// Project-scoped helper hooks (unchanged from original)
// ---------------------------------------------------------------------------

export function useProjectShots(projectId: string | null) {
  const { shots } = useProjects();
  return shots.filter(s => s.projectId === projectId);
}

export function useProjectSchedule(projectId: string | null) {
  const { schedule } = useProjects();
  return schedule.filter(d => d.projectId === projectId).sort((a, b) => a.dayNumber - b.dayNumber);
}

export function useProjectTakes(projectId: string | null) {
  const { takes } = useProjects();
  return takes.filter(t => t.projectId === projectId);
}

export function useProjectScenes(projectId: string | null) {
  const { scenes } = useProjects();
  return (scenes ?? [])
    .filter(s => s.projectId === projectId)
    .sort((a, b) => compareSceneNumbers(a.number, b.number));
}

/**
 * Resolve the Scene a record belongs to, preferring the explicit link and
 * falling back to the loose scene number that predates it.
 */
export function findScene(
  scenes: Scene[],
  sceneId: string | undefined,
  sceneNumber: number | string | undefined,
): Scene | null {
  if (sceneId) {
    const byId = scenes.find(s => s.id === sceneId);
    if (byId) return byId;
  }
  if (sceneNumber === undefined || sceneNumber === null || sceneNumber === '') return null;
  const wanted = String(sceneNumber).trim().toUpperCase();
  return scenes.find(s => String(s.number).trim().toUpperCase() === wanted) ?? null;
}

/** Someone on this production: the contact, plus what they are here. */
export interface AssignedCrew extends CrewMember {
  assignmentId: string;
  /** Role on this production, falling back to the contact's default role. */
  projectRole: string;
  /** Their standard call, or undefined when they are on the general call. */
  callTime?: string;
}

/**
 * Crew working on this project — not every contact ever entered, which is what
 * the directory and every call sheet used to show (#40).
 */
export function useProjectCrew(projectId: string | null): AssignedCrew[] {
  const { crew, crewAssignments } = useProjects();
  const byId = new Map(crew.map(c => [c.id, c]));

  const assigned: AssignedCrew[] = [];
  for (const a of crewAssignments ?? []) {
    if (a.projectId !== projectId) continue;
    const person = byId.get(a.crewMemberId);
    if (!person) continue;               // contact deleted; assignment is stale
    assigned.push({
      ...person,
      assignmentId: a.id,
      projectRole: a.role?.trim() || person.role,
      callTime: a.callTime?.trim() || undefined,
    });
  }

  return assigned.sort((a, b) =>
    a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

export function useProjectBreakdowns(projectId: string | null) {
  const { sceneBreakdowns } = useProjects();
  return sceneBreakdowns.filter(b => b.projectId === projectId).sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export function useProjectLocations(projectId: string | null) {
  const { locations } = useProjects();
  return locations.filter(l => l.projectId === projectId);
}

export function useProjectBudget(projectId: string | null) {
  const { budgetItems } = useProjects();
  return budgetItems.filter(b => b.projectId === projectId);
}

export function useProjectContinuity(projectId: string | null) {
  const { continuityNotes } = useProjects();
  return continuityNotes.filter(c => c.projectId === projectId);
}

export function useProjectVFX(projectId: string | null) {
  const { vfxShots } = useProjects();
  return vfxShots.filter(v => v.projectId === projectId);
}

export function useProjectFestivals(projectId: string | null) {
  const { festivals } = useProjects();
  return festivals.filter(f => f.projectId === projectId);
}

export function useProjectNotes(projectId: string | null) {
  const { productionNotes } = useProjects();
  return productionNotes.filter(n => n.projectId === projectId);
}

export function useProjectMoodBoard(projectId: string | null) {
  const { moodBoardItems } = useProjects();
  return moodBoardItems.filter(m => m.projectId === projectId);
}

export function useProjectShotReferences(projectId: string | null) {
  const { shotReferences } = useProjects();
  return shotReferences.filter(r => r.projectId === projectId);
}

export function useProjectWrapReports(projectId: string | null) {
  const { wrapReports } = useProjects();
  return wrapReports.filter(r => r.projectId === projectId).sort((a, b) => a.dayNumber - b.dayNumber);
}

export function useProjectBlockingNotes(projectId: string | null) {
  const { blockingNotes } = useProjects();
  return blockingNotes.filter(b => b.projectId === projectId).sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export function useProjectColorReferences(projectId: string | null) {
  const { colorReferences } = useProjects();
  return colorReferences.filter(c => c.projectId === projectId);
}

export function useProjectTimeEntries(projectId: string | null) {
  const { timeEntries } = useProjects();
  return timeEntries.filter(t => t.projectId === projectId);
}

export function useLocationWeatherData(locationId: string | null) {
  const { locationWeather } = useProjects();
  return locationWeather.filter(w => w.locationId === locationId).sort((a, b) => a.date.localeCompare(b.date));
}

export function useProjectScriptSides(projectId: string | null) {
  const { scriptSides } = useProjects();
  return scriptSides.filter(s => s.projectId === projectId).sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export function useProjectCast(projectId: string | null) {
  const { castMembers } = useProjects();
  return castMembers.filter(c => c.projectId === projectId).sort((a, b) => a.characterName.localeCompare(b.characterName));
}

/**
 * Cast call times for one shoot day, keyed by cast member id.
 *
 * A Map rather than a list because every lookup is "what is this person's
 * makeup call", and the absence of a row is the common case — nobody has to be
 * given a time for the sheet to be right.
 */
export function useDayCastCallTimes(scheduleDayId: string | null): Map<string, CastCallTime> {
  const { castCallTimes } = useProjects();
  return castTimesForDay(castCallTimes ?? [], scheduleDayId);
}

/** The call sheet block for one shoot day, or null before anything is filled in. */
export function useCallSheetDetails(scheduleDayId: string | null): CallSheetDetails | null {
  const { callSheetDetails } = useProjects();
  if (!scheduleDayId) return null;
  return (callSheetDetails ?? []).find(d => d.scheduleDayId === scheduleDayId) ?? null;
}

export function useProjectLookbook(projectId: string | null) {
  const { lookbookItems } = useProjects();
  return lookbookItems.filter(l => l.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function useProjectDirectorStatement(projectId: string | null) {
  const { directorStatements } = useProjects();
  return (directorStatements ?? []).find(s => s.projectId === projectId) ?? null;
}

export function useProjectSelects(projectId: string | null) {
  const { sceneSelects } = useProjects();
  return sceneSelects.filter(s => s.projectId === projectId).sort((a, b) =>
    a.sceneNumber - b.sceneNumber ||
    a.shotNumber.localeCompare(b.shotNumber) ||
    b.rating - a.rating
  );
}

export function useProjectMessages(projectId: string | null) {
  const { directorMessages } = useProjects();
  return (directorMessages ?? []).filter(m => m.projectId === projectId).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function useProjectScriptPDFs(projectId: string | null) {
  const { scriptPDFs } = useProjects();
  return scriptPDFs.filter(s => s.projectId === projectId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function useScriptAnnotations(scriptPdfId: string | null) {
  const { scriptAnnotations } = useProjects();
  return scriptAnnotations.filter(a => a.scriptPdfId === scriptPdfId);
}

export function useProjectLightingDiagrams(projectId: string | null) {
  const { lightingDiagrams } = useProjects();
  return lightingDiagrams.filter(d => d.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
