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
  /**
   * Link to the Scene record. Optional because shots created before scenes
   * existed are backfilled by matching `sceneNumber`, and a shot can be typed
   * against a scene number that has no Scene record yet.
   */
  sceneId?: string;
  /** Legacy loose link, kept so existing shots keep grouping while sceneId spreads. */
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
  /**
   * Scenes scheduled for this day. Optional because days created before
   * scenes existed are backfilled by parsing `scenes` below.
   */
  sceneIds?: string[];
  /**
   * Legacy free-text scene list ("Sc. 1, 5, 8"). Kept in sync with `sceneIds`
   * so call sheets, exports and the project summary keep rendering while the
   * links spread. Derived, not authoritative.
   */
  scenes: string;
  location: string;
  callTime: string;
  wrapTime: string;
  notes: string;
}

/**
 * A person. Global, not per-project: a director reuses the same gaffer across
 * films, so the contact is an address book entry and the *assignment* is what
 * is project-specific. See CrewAssignment.
 */
export interface CrewMember {
  id: string;
  name: string;
  role: string;
  department: Department;
  phone: string;
  email: string;
}

/**
 * Someone working on a particular production.
 *
 * This is what makes crew project-scoped (#40) without guessing which film an
 * existing contact belonged to — the contacts stay put and assignments are
 * added alongside them.
 */
export interface CrewAssignment {
  id: string;
  projectId: string;
  crewMemberId: string;
  /** Role on this production; a gaffer on one film is a best boy on another. */
  role?: string;
  /**
   * This person's standard call for this production. Empty means they are on
   * the general call — which is what every call sheet printed before (#39).
   */
  callTime?: string;
  createdAt: string;
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

/**
 * A scene — the spine the rest of the app hangs off.
 *
 * Everything used to reference scenes by a loose `sceneNumber: number`, which
 * cannot express "14A", breaks on every renumbered revision, and makes page
 * counts, cast day-out-of-days and "today's shots" unanswerable. Scene records
 * are the thing shots, shoot days, sides, continuity and selects point at.
 */
export interface Scene {
  id: string;
  projectId: string;
  /** As written on the page — "14", "14A", "A14". Deliberately not a number. */
  number: string;
  /** Slugline: "INT. LIGHTHOUSE - NIGHT". */
  heading: string;
  intExt: SceneIntExt;
  timeOfDay: SceneTimeOfDay;
  location: string;
  /**
   * Page length in eighths (20 = 2 4/8 pages). Integer so day totals stay
   * exact — see utils/eighths.ts.
   */
  pageEighths: number;
  /**
   * Character names. Not CastMember ids yet: the data being migrated holds
   * names, and inventing ids for them would be a lossy guess. Linking these to
   * cast records is a follow-up.
   */
  cast: string[];
  extras: string;
  props: string[];
  wardrobe: string[];
  specialEquipment: string[];
  synopsis: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * @deprecated Superseded by `Scene`, which absorbs these fields. Retained so
 * lib/sceneMigration.ts can read records written by earlier versions; no screen
 * reads this any more.
 */
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
  /** Stored via persistPhoto — resolve with resolvePhotoUri before rendering. */
  photoUrl?: string;
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

/**
 * When an actor is due, on one particular day.
 *
 * Per shoot day, not per production: makeup at 5:30 on a prosthetics day and
 * 7:15 on the next is the normal case, and it is the reason call sheets get
 * reissued at all. `CrewAssignment.callTime` is still per-production (#39) and
 * is expected to move to this shape.
 *
 * A missing row, or a blank field, means that person is on the general call —
 * so nothing has to be filled in for the sheet to be correct.
 */
export interface CastCallTime {
  id: string;
  projectId: string;
  scheduleDayId: string;
  castMemberId: string;
  /** In the makeup chair. */
  makeupTime?: string;
  /** In wardrobe. */
  wardrobeTime?: string;
  /** On set, ready to shoot — the time that actually matters to the day. */
  onSetTime?: string;
  notes?: string;
  createdAt: string;
}

/**
 * The call sheet's header block for one shoot day.
 *
 * Deliberately not fields on `ScheduleDay`: a shoot day is a scheduling
 * record, while hospital directions and walkie channels are facts about the
 * document issued for it. One row per day, created the first time anything is
 * filled in — an absent row simply means those sections are blank.
 */
export interface CallSheetDetails {
  id: string;
  projectId: string;
  scheduleDayId: string;

  /** Safety. The nearest hospital is the line that matters when nothing else does. */
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  safetyNotes?: string;

  parkingNotes?: string;
  basecampNotes?: string;
  crewParkNotes?: string;
  nearestBathroom?: string;
  walkieChannels?: string;
  cateringLocation?: string;
  breakfastTime?: string;
  lunchTime?: string;
  companyMoves?: string;

  /** Bumped on reissue, so crew can tell which sheet is current. */
  version: number;
  /** When this version was issued. Absent until it has been. */
  issuedAt?: string;
  createdAt: string;
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

// ----------------------------------------------------------------------------
// Script PDF (full script document with annotations)
// ----------------------------------------------------------------------------

export type ScriptRevisionColor =
  | 'white'
  | 'blue'
  | 'pink'
  | 'yellow'
  | 'green'
  | 'goldenrod'
  | 'buff'
  | 'salmon'
  | 'cherry';

export interface ScriptPDF {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  filePath: string;        // Path inside the Supabase 'scripts' storage bucket
  fileSize: number;
  pageCount: number;
  version?: string;        // e.g. "Draft 3", "Shooting Script"
  colorCode?: ScriptRevisionColor;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AnnotationType = 'highlight' | 'note' | 'drawing';

export interface ScriptAnnotation {
  id: string;
  scriptPdfId: string;
  projectId: string;
  userId: string;
  pageNumber: number;
  type: AnnotationType;
  color: string;            // hex color, e.g. "#FFEB3B" for highlight
  // Highlight: normalized rect (0-1, relative to page size)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Note: text content
  textContent?: string;
  // Drawing: serialized SVG path data (e.g. "M10,20 L30,40 L50,10")
  pathData?: string;
  strokeWidth?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Lighting Diagrams
// ----------------------------------------------------------------------------

export type LightingElementType =
  // Lights
  | 'key-light'
  | 'fill-light'
  | 'back-light'
  | 'hair-light'
  | 'kicker'
  | 'practical'
  // Modifiers
  | 'bounce'
  | 'reflector'
  | 'flag'
  | 'diffusion'
  | 'gel'
  // Set pieces
  | 'wall'
  | 'window'
  | 'prop'
  // People / camera
  | 'camera'
  | 'actor'
  | 'custom';

export type LightIntensity = 'low' | 'medium' | 'high' | 'max';

export interface LightingElement {
  id: string;
  type: LightingElementType;
  label: string;
  /** Normalized x position (0–1, relative to canvas width) */
  x: number;
  /** Normalized y position (0–1, relative to canvas height) */
  y: number;
  /** Rotation in degrees, 0–360 */
  rotation: number;
  /** Scale multiplier, default 1 */
  scale: number;
  /** Hex color string */
  color?: string;
  /** Beam intensity (lights only) */
  intensity?: LightIntensity;
  /** Optional notes for this element */
  notes?: string;
}

export type LightingTemplateName =
  | 'blank'
  | 'three-point'
  | 'rembrandt'
  | 'butterfly'
  | 'split'
  | 'loop'
  | 'broad'
  | 'short-side'
  | 'backlight-only'
  | 'natural-window';

export interface LightingDiagram {
  id: string;
  projectId: string;
  title: string;
  sceneNumber?: number;
  shotNumber?: string;
  templateName: LightingTemplateName | string;
  description?: string;
  notes?: string;
  elements: LightingElement[];
  createdAt: string;
  updatedAt: string;
}
