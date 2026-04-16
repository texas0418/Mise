import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  Project, Shot, ScheduleDay, CrewMember, Take, SceneBreakdown,
  LocationScout, BudgetItem, ContinuityNote, VFXShot, FestivalSubmission,
  ProductionNote, MoodBoardItem, DirectorCredit, ShotReference, WrapReport,
  LocationWeather, BlockingNote, ColorReference, TimeEntry, ScriptSide,
  CastMember, LookbookItem, DirectorStatement, SceneSelect, DirectorMessage
} from '@/types';
import {
  SAMPLE_PROJECTS, SAMPLE_SHOTS, SAMPLE_SCHEDULE, SAMPLE_CREW,
  SAMPLE_TAKES, SAMPLE_SCENE_BREAKDOWNS, SAMPLE_LOCATIONS, SAMPLE_BUDGET,
  SAMPLE_CONTINUITY, SAMPLE_VFX, SAMPLE_FESTIVALS, SAMPLE_NOTES,
  SAMPLE_MOOD_BOARD, SAMPLE_CREDITS, SAMPLE_SHOT_REFERENCES,
  SAMPLE_WRAP_REPORTS, SAMPLE_LOCATION_WEATHER, SAMPLE_BLOCKING_NOTES,
  SAMPLE_COLOR_REFERENCES, SAMPLE_TIME_ENTRIES, SAMPLE_SCRIPT_SIDES,
  SAMPLE_CAST, SAMPLE_LOOKBOOK, SAMPLE_DIRECTOR_STATEMENT,
  SAMPLE_SELECTS, SAMPLE_MESSAGES
} from '@/mocks/data';
import { useSync } from '@/contexts/SyncContext';

const STORAGE_KEYS = {
  projects: 'mise_projects',
  shots: 'mise_shots',
  schedule: 'mise_schedule',
  crew: 'mise_crew',
  takes: 'mise_takes',
  activeProject: 'mise_active_project',
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
  lookbook: 'mise_lookbook',
  directorStatement: 'mise_director_statement',
  selects: 'mise_selects',
  messages: 'mise_messages',
};

async function loadFromStorage<T>(key: string, fallback: T[]): Promise<T[]> {
  const safeFallback = fallback ?? ([] as T[]);
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
      await AsyncStorage.removeItem(key);
    }
    if (safeFallback.length > 0) {
      await AsyncStorage.setItem(key, JSON.stringify(safeFallback));
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
// useEntityStore — now accepts supabaseTable to enqueue mutations for sync.
// The enqueueMutation function is passed in so this hook doesn't call useSync
// directly (useSync is called once in the parent createContextHook).
// ---------------------------------------------------------------------------
function useEntityStore<T extends { id: string }>(
  queryKey: string,
  storageKey: string,
  fallback: T[],
  supabaseTable: string,
  enqueueMutation: (table: string, recordId: string, action: 'insert' | 'update' | 'delete', data: Record<string, any> | null) => Promise<void>,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => loadFromStorage<T>(storageKey, fallback),
  });

  const saveMutation = useMutation({
    mutationFn: (data: T[]) => saveToStorage(storageKey, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  });

  const items = query.data ?? [];

  const add = useCallback((item: T) => {
    saveMutation.mutate([...items, item]);
    enqueueMutation(supabaseTable, item.id, 'insert', item as any);
  }, [items, supabaseTable]);

  const addBulk = useCallback((newItems: T[]) => {
    saveMutation.mutate([...items, ...newItems]);
    // Enqueue each item individually for sync
    for (const item of newItems) {
      enqueueMutation(supabaseTable, item.id, 'insert', item as any);
    }
  }, [items, supabaseTable]);

  const update = useCallback((item: T) => {
    saveMutation.mutate(items.map(i => i.id === item.id ? item : i));
    enqueueMutation(supabaseTable, item.id, 'update', item as any);
  }, [items, supabaseTable]);

  const remove = useCallback((id: string) => {
    saveMutation.mutate(items.filter(i => i.id !== id));
    enqueueMutation(supabaseTable, id, 'delete', null);
  }, [items, supabaseTable]);

  return { items, add, addBulk, update, remove, isLoading: query.isLoading };
}

export const [ProjectProvider, useProjects] = createContextHook(() => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Get enqueueMutation from SyncContext — if sync is disabled, this is a no-op
  const { enqueueMutation } = useSync();

  const projectStore = useEntityStore<Project>('projects', STORAGE_KEYS.projects, SAMPLE_PROJECTS, 'projects', enqueueMutation);
  const shotStore = useEntityStore<Shot>('shots', STORAGE_KEYS.shots, SAMPLE_SHOTS, 'shots', enqueueMutation);
  const scheduleStore = useEntityStore<ScheduleDay>('schedule', STORAGE_KEYS.schedule, SAMPLE_SCHEDULE, 'schedule_days', enqueueMutation);
  const crewStore = useEntityStore<CrewMember>('crew', STORAGE_KEYS.crew, SAMPLE_CREW, 'crew_members', enqueueMutation);
  const takeStore = useEntityStore<Take>('takes', STORAGE_KEYS.takes, SAMPLE_TAKES, 'takes', enqueueMutation);
  const breakdownStore = useEntityStore<SceneBreakdown>('sceneBreakdowns', STORAGE_KEYS.sceneBreakdowns, SAMPLE_SCENE_BREAKDOWNS, 'scene_breakdowns', enqueueMutation);
  const locationStore = useEntityStore<LocationScout>('locations', STORAGE_KEYS.locations, SAMPLE_LOCATIONS, 'location_scouts', enqueueMutation);
  const budgetStore = useEntityStore<BudgetItem>('budget', STORAGE_KEYS.budget, SAMPLE_BUDGET, 'budget_items', enqueueMutation);
  const continuityStore = useEntityStore<ContinuityNote>('continuity', STORAGE_KEYS.continuity, SAMPLE_CONTINUITY, 'continuity_notes', enqueueMutation);
  const vfxStore = useEntityStore<VFXShot>('vfx', STORAGE_KEYS.vfx, SAMPLE_VFX, 'vfx_shots', enqueueMutation);
  const festivalStore = useEntityStore<FestivalSubmission>('festivals', STORAGE_KEYS.festivals, SAMPLE_FESTIVALS, 'festival_submissions', enqueueMutation);
  const noteStore = useEntityStore<ProductionNote>('notes', STORAGE_KEYS.notes, SAMPLE_NOTES, 'production_notes', enqueueMutation);
  const moodBoardStore = useEntityStore<MoodBoardItem>('moodBoard', STORAGE_KEYS.moodBoard, SAMPLE_MOOD_BOARD, 'mood_board_items', enqueueMutation);
  const creditStore = useEntityStore<DirectorCredit>('credits', STORAGE_KEYS.credits, SAMPLE_CREDITS, 'director_credits', enqueueMutation);
  const shotRefStore = useEntityStore<ShotReference>('shotReferences', STORAGE_KEYS.shotReferences, SAMPLE_SHOT_REFERENCES, 'shot_references', enqueueMutation);
  const wrapReportStore = useEntityStore<WrapReport>('wrapReports', STORAGE_KEYS.wrapReports, SAMPLE_WRAP_REPORTS, 'wrap_reports', enqueueMutation);
  const locationWeatherStore = useEntityStore<LocationWeather>('locationWeather', STORAGE_KEYS.locationWeather, SAMPLE_LOCATION_WEATHER, 'location_weather', enqueueMutation);
  const blockingStore = useEntityStore<BlockingNote>('blockingNotes', STORAGE_KEYS.blockingNotes, SAMPLE_BLOCKING_NOTES, 'blocking_notes', enqueueMutation);
  const colorRefStore = useEntityStore<ColorReference>('colorReferences', STORAGE_KEYS.colorReferences, SAMPLE_COLOR_REFERENCES, 'color_references', enqueueMutation);
  const timeEntryStore = useEntityStore<TimeEntry>('timeEntries', STORAGE_KEYS.timeEntries, SAMPLE_TIME_ENTRIES, 'time_entries', enqueueMutation);
  const scriptSideStore = useEntityStore<ScriptSide>('scriptSides', STORAGE_KEYS.scriptSides, SAMPLE_SCRIPT_SIDES, 'script_sides', enqueueMutation);
  const castStore = useEntityStore<CastMember>('cast', STORAGE_KEYS.cast, SAMPLE_CAST, 'cast_members', enqueueMutation);
  const lookbookStore = useEntityStore<LookbookItem>('lookbook', STORAGE_KEYS.lookbook, SAMPLE_LOOKBOOK, 'lookbook_items', enqueueMutation);
  const directorStatementStore = useEntityStore<DirectorStatement>('directorStatement', STORAGE_KEYS.directorStatement, SAMPLE_DIRECTOR_STATEMENT, 'director_statements', enqueueMutation);
  const selectStore = useEntityStore<SceneSelect>('selects', STORAGE_KEYS.selects, SAMPLE_SELECTS, 'scene_selects', enqueueMutation);
  const messageStore = useEntityStore<DirectorMessage>('messages', STORAGE_KEYS.messages, SAMPLE_MESSAGES, 'director_messages', enqueueMutation);

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
  const takes = takeStore.items;
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
  const lookbookItems = lookbookStore.items;
  const directorStatements = directorStatementStore.items;
  const sceneSelects = selectStore.items;
  const directorMessages = messageStore.items;

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const isLoading = projectStore.isLoading || shotStore.isLoading || scheduleStore.isLoading || crewStore.isLoading || takeStore.isLoading;

  return {
    projects, shots, schedule, crew, takes, sceneBreakdowns, locations,
    budgetItems, continuityNotes, vfxShots, festivals, productionNotes,
    moodBoardItems, directorCredits, shotReferences, wrapReports,
    locationWeather, blockingNotes, colorReferences, timeEntries,
    scriptSides, castMembers, lookbookItems, directorStatements,
    sceneSelects, directorMessages, activeProject, activeProjectId,
    isLoading, selectProject,

    addProject: projectStore.add, updateProject: projectStore.update, deleteProject: projectStore.remove,
    addShot: shotStore.add, updateShot: shotStore.update, deleteShot: shotStore.remove,
    addScheduleDay: scheduleStore.add, updateScheduleDay: scheduleStore.update, deleteScheduleDay: scheduleStore.remove,
    addCrewMember: crewStore.add, updateCrewMember: crewStore.update, deleteCrewMember: crewStore.remove,
    addTake: takeStore.add, updateTake: takeStore.update,
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
    addLookbookItem: lookbookStore.add, updateLookbookItem: lookbookStore.update, deleteLookbookItem: lookbookStore.remove,
    addDirectorStatement: directorStatementStore.add, updateDirectorStatement: directorStatementStore.update, deleteDirectorStatement: directorStatementStore.remove,
    addSceneSelect: selectStore.add, updateSceneSelect: selectStore.update, deleteSceneSelect: selectStore.remove,
    addMessage: messageStore.add, updateMessage: messageStore.update, deleteMessage: messageStore.remove,

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
