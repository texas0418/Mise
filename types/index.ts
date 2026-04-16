export type ProjectStatus = 'development' | 'pre-production' | 'production' | 'post-production' | 'completed';

export type ShotType = 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'over-shoulder' | 'pov' | 'aerial' | 'insert' | 'two-shot' | 'establishing';

export type ShotMovement = 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld' | 'steadicam' | 'zoom';

export type ShotStatus = 'planned' | 'ready' | 'shot' | 'approved';

export type Department = 'direction' | 'camera' | 'sound' | 'art' | 'lighting' | 'production' | 'talent' | 'postProduction';

export type SceneTimeOfDay = 'day' | 'night' | 'dawn' | 'dusk' | 'magic-hour';

export type SceneIntExt = 'INT' | 'EXT' | 'INT/EXT';

export type BudgetCategory = 'talent' | 'crew' | 'equipment' | 'locations' | 'production-design' | 'post-production' | 'music' | 'marketing' | 'legal' | 'insurance' | 'catering' | 'transport' | 'contingency' | 'other';

export type VFXShotStatus = 'pending' | 'in-progress' | 'review' | 'approved' | 'final';

export type VFXComplexity = 'simple' | 'moderate' | 'complex' | 'hero';

export type FestivalStatus = 'researching' | 'submitted' | 'accepted' | 'rejected' | 'screening' | 'awarded';

export type NoteCategory = 'general' | 'creative' | 'technical' | 'logistics' | 'feedback' | 'revision';

export type MoodBoardItemType = 'color' | 'reference' | 'note';

export interface Project {
  id: string;
  title: string;
  logline: string;
  genre: string;
  status: ProjectStatus;
  format: string;
  createdAt: string;
  imageUrl?: string;
  budget?: number;
  director?: string;
  producer?: string;
}

export interface Shot {
  id: string;
  projectId: string;
  sceneNumber: number;
  shotNumber: string;
  type: ShotType;
  movement: ShotMovement;
  lens: string;
  description: string;
  notes: string;
  status: ShotStatus;
}

export interface ScheduleDay {
  id: string;
  projectId: string;
  date: string;
  dayNumber: number;
  scenes: string;
  location: string;
  callTime: string;
  wrapTime: string;
  notes: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  department: Department;
  phone: string;
  email: string;
}

export interface Take {
  id: string;
  projectId: string;
  sceneNumber: number;
  shotNumber: string;
  takeNumber: number;
  isCircled: boolean;
  isNG: boolean;
  notes: string;
  timestamp: string;
}

export interface SceneBreakdown {
  id: string;
  projectId: string;
  sceneNumber: number;
  sceneName: string;
  intExt: SceneIntExt;
  timeOfDay: SceneTimeOfDay;
  location: string;
  cast: string[];
  extras: string;
  props: string[];
  wardrobe: string[];
  specialEquipment: string[];
  notes: string;
  pageCount: string;
}

export interface LocationScout {
  id: string;
  projectId: string;
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  permitRequired: boolean;
  permitStatus: string;
  parkingNotes: string;
  powerAvailable: boolean;
  notes: string;
  rating: number;
  photoUrls: string[];
  scenes: string[];
  latitude?: number;
  longitude?: number;
}

export interface BudgetItem {
  id: string;
  projectId: string;
  category: BudgetCategory;
  description: string;
  estimated: number;
  actual: number;
  notes: string;
  vendor?: string;
  paid: boolean;
}

export interface ContinuityNote {
  id: string;
  projectId: string;
  sceneNumber: number;
  shotNumber: string;
  description: string;
  details: string;
  timestamp: string;
}

export interface VFXShot {
  id: string;
  projectId: string;
  sceneNumber: number;
  shotNumber: string;
  description: string;
  complexity: VFXComplexity;
  status: VFXShotStatus;
  vendor: string;
  deadline: string;
  notes: string;
  estimatedCost: number;
}

export interface FestivalSubmission {
  id: string;
  projectId: string;
  festivalName: string;
  location: string;
  deadline: string;
  submissionDate: string;
  fee: number;
  status: FestivalStatus;
  category: string;
  platformUrl: string;
  notes: string;
  notificationDate: string;
}

export interface ProductionNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  category: NoteCategory;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

export interface MoodBoardItem {
  id: string;
  projectId: string;
  boardName: string;
  type: MoodBoardItemType;
  imageUrl?: string;
  color?: string;
  note?: string;
  label: string;
}

export interface CallSheetEntry {
  id: string;
  projectId: string;
  scheduleDayId: string;
  crewMemberId: string;
  callTime: string;
  role: string;
  notes: string;
}

export interface DirectorCredit {
  id: string;
  title: string;
  role: string;
  year: string;
  format: string;
  festival?: string;
  award?: string;
  notes: string;
}

// === NEW FEATURE TYPES ===

// 1. Shot Storyboard / References
export interface ShotReference {
  id: string;
  projectId: string;
  shotId?: string;
  sceneNumber?: number;
  title: string;
  imageUrl: string;
  shotType?: ShotType;
  lightingStyle?: string;
  notes: string;
  tags: string[];
}

// 2. Daily Wrap Report
export interface WrapReport {
  id: string;
  projectId: string;
  scheduleDayId: string;
  dayNumber: number;
  date: string;
  callTime: string;
  actualWrap: string;
  scheduledWrap: string;
  scenesScheduled: string;
  scenesCompleted: string;
  shotsPlanned: number;
  shotsCompleted: number;
  totalTakes: number;
  circledTakes: number;
  ngTakes: number;
  pagesScheduled: string;
  pagesCompleted: string;
  overtimeMinutes: number;
  notes: string;
  safetyIncidents: string;
  weatherConditions: string;
  createdAt: string;
}

// 3. Location Weather
export interface LocationWeather {
  id: string;
  locationId: string;
  date: string;
  sunrise: string;
  sunset: string;
  goldenHourAM: string;
  goldenHourPM: string;
  tempHigh: number;
  tempLow: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind';
  windSpeed: number;
  humidity: number;
  precipChance: number;
  notes: string;
}

// 4. Export template types
export type ExportFormat = 'shot-list' | 'call-sheet' | 'schedule' | 'wrap-report' | 'budget-summary';

// 5. Blocking / Rehearsal Notes
export interface BlockingNote {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  description: string;
  actorPositions: string;
  cameraPosition: string;
  movementNotes: string;
  diagramUrl?: string;
  notes: string;
  createdAt: string;
}

// 6. Color / LUT Reference
export type LUTStyle = 'neutral' | 'warm-film' | 'cool-blue' | 'desaturated' | 'high-contrast' | 'vintage' | 'bleach-bypass' | 'teal-orange' | 'noir' | 'pastel';

export interface ColorReference {
  id: string;
  projectId: string;
  sceneNumber?: number;
  name: string;
  lutStyle: LUTStyle;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contrast: 'low' | 'medium' | 'high';
  saturation: 'desaturated' | 'natural' | 'saturated';
  temperature: 'cool' | 'neutral' | 'warm';
  referenceFilm?: string;
  notes: string;
}

// 7. (Export/Share covered by ExportFormat above)

// 8. Overtime / Time Tracker
export interface TimeEntry {
  id: string;
  projectId: string;
  scheduleDayId: string;
  crewMemberId?: string;
  department?: Department;
  date: string;
  callTime: string;
  wrapTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  scheduledHours: number;
  actualHours: number;
  overtimeHours: number;
  rate?: number;
  notes: string;
}

// Script Sides
export type SidesStatus = 'upcoming' | 'shooting-today' | 'completed' | 'revised';

export interface SideAnnotation {
  id: string;
  text: string;
  type: 'blocking' | 'performance' | 'camera' | 'general';
  timestamp: string;
}

export interface ScriptSide {
  id: string;
  projectId: string;
  sceneNumber: number;
  sceneHeader: string;
  pageStart: string;
  pageEnd: string;
  pageCount: number;
  shootDate: string;
  status: SidesStatus;
  synopsis: string;
  castIds: string[];
  linkedShotIds: string[];
  annotations: SideAnnotation[];
  revisionColor?: string;
  revisionDate?: string;
  notes: string;
  createdAt: string;
}

// Cast Manager
export type CastStatus = 'confirmed' | 'in-talks' | 'auditioned' | 'wishlist' | 'wrapped';

export interface CastMember {
  id: string;
  projectId: string;
  actorName: string;
  characterName: string;
  characterDescription: string;
  status: CastStatus;
  headshot?: string;
  email?: string;
  phone?: string;
  agentName?: string;
  agentContact?: string;
  scenes: number[];
  shootDays: string[];
  availability: string;
  performanceNotes: string;
  preferredTakes?: string;
  costumeNotes?: string;
  createdAt: string;
}

// Director's Lookbook
export type LookbookSectionType = 'tone' | 'visual-style' | 'color-palette' | 'shot-style' | 'reference-film' | 'character-look' | 'world-building' | 'sound-music' | 'custom';

export interface LookbookItem {
  id: string;
  projectId: string;
  section: LookbookSectionType;
  title: string;
  description: string;
  imageUrl?: string;
  referenceFilm?: string;
  colorHex?: string;
  sortOrder: number;
  createdAt: string;
}

export interface DirectorStatement {
  id: string;
  projectId: string;
  text: string;
  updatedAt: string;
}

// Scene Selects
export type SelectRating = 1 | 2 | 3 | 4 | 5;

export interface SceneSelect {
  id: string;
  projectId: string;
  sceneNumber: number;
  shotNumber: string;
  takeNumber: number;
  rating: SelectRating;
  isCircled: boolean;
  isAlt: boolean;
  editorNote: string;
  performanceNote: string;
  technicalNote: string;
  timecode?: string;
  createdAt: string;
}

// Communication Hub
export type MessagePriority = 'normal' | 'urgent' | 'fyi';
export type MessageCategory = 'moving-on' | 'pickup' | 'schedule-change' | 'safety' | 'creative' | 'general';

export interface DirectorMessage {
  id: string;
  projectId: string;
  category: MessageCategory;
  priority: MessagePriority;
  subject: string;
  body: string;
  recipients: string[]; // department names or crew member names
  sentAt: string;
  sceneNumber?: number;
}
