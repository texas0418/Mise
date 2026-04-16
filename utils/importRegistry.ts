/**
 * utils/importRegistry.ts
 * 
 * Entity Import Registry for Mise App
 * Phase 1, Item 4
 * 
 * Central registry defining, for each importable entity type, the required fields,
 * optional fields, valid enum values, default values, and common aliases.
 * Both spreadsheet import and AI import reference this registry.
 */

import { FieldDefinition } from './fieldMapper';

// ─── Types ─────────────────────────────────────────────────────────

export interface EntityConfig {
  /** Unique key matching the entity store name */
  key: string;
  /** Human-readable name */
  label: string;
  /** Short description shown in the import UI */
  description: string;
  /** Field definitions for mapping and validation */
  fields: FieldDefinition[];
  /** Which context method to call for bulk add (e.g. 'addCrewMember') */
  addMethod: string;
  /** Example CSV row for template generation */
  exampleRow: Record<string, string>;
}

// ─── Entity Definitions ────────────────────────────────────────────

export const CREW_MEMBER_CONFIG: EntityConfig = {
  key: 'crew',
  label: 'Crew Members',
  description: 'Cast & crew directory with contact info and department assignments',
  addMethod: 'addCrewMember',
  fields: [
    { key: 'name', label: 'Name', type: 'string', required: true, aliases: ['full name', 'crew name', 'member name', 'person'] },
    { key: 'role', label: 'Role', type: 'string', required: true, aliases: ['job title', 'position', 'title', 'job'] },
    { key: 'department', label: 'Department', type: 'enum', required: true,
      enumValues: ['direction', 'camera', 'sound', 'art', 'lighting', 'production', 'talent', 'postProduction'],
      aliases: ['dept', 'team', 'unit'],
      defaultValue: 'production',
    },
    { key: 'phone', label: 'Phone', type: 'string', required: false, aliases: ['phone number', 'tel', 'telephone', 'mobile', 'cell'], defaultValue: '' },
    { key: 'email', label: 'Email', type: 'string', required: false, aliases: ['email address', 'e-mail', 'mail'], defaultValue: '' },
  ],
  exampleRow: { name: 'John Smith', role: 'Director of Photography', department: 'camera', phone: '555-0123', email: 'john@example.com' },
};

export const SHOT_CONFIG: EntityConfig = {
  key: 'shots',
  label: 'Shots',
  description: 'Shot list with scene numbers, types, movement, and lens info',
  addMethod: 'addShot',
  fields: [
    { key: 'sceneNumber', label: 'Scene Number', type: 'number', required: true, aliases: ['scene', 'scene #', 'scene no', 'sc'] },
    { key: 'shotNumber', label: 'Shot Number', type: 'string', required: true, aliases: ['shot', 'shot #', 'shot no', 'shot id'] },
    { key: 'type', label: 'Shot Type', type: 'enum', required: false,
      enumValues: ['wide', 'medium', 'close-up', 'extreme-close-up', 'over-shoulder', 'pov', 'aerial', 'insert', 'two-shot', 'establishing'],
      aliases: ['shot type', 'size', 'framing'],
      defaultValue: 'medium',
    },
    { key: 'movement', label: 'Camera Movement', type: 'enum', required: false,
      enumValues: ['static', 'pan', 'tilt', 'dolly', 'tracking', 'crane', 'handheld', 'steadicam', 'zoom'],
      aliases: ['movement', 'camera move', 'motion'],
      defaultValue: 'static',
    },
    { key: 'lens', label: 'Lens', type: 'string', required: false, aliases: ['focal length', 'mm', 'optics'], defaultValue: '' },
    { key: 'description', label: 'Description', type: 'string', required: false, aliases: ['desc', 'shot description', 'action', 'details'], defaultValue: '' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments', 'remarks'], defaultValue: '' },
    { key: 'status', label: 'Status', type: 'enum', required: false,
      enumValues: ['planned', 'ready', 'shot', 'approved'],
      defaultValue: 'planned',
    },
  ],
  exampleRow: { sceneNumber: '1', shotNumber: '1A', type: 'wide', movement: 'dolly', lens: '35mm', description: 'Establishing shot of house', notes: '', status: 'planned' },
};

export const SCHEDULE_CONFIG: EntityConfig = {
  key: 'schedule',
  label: 'Schedule Days',
  description: 'Production schedule with dates, locations, and call times',
  addMethod: 'addScheduleDay',
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true, aliases: ['shoot date', 'day date', 'when'] },
    { key: 'dayNumber', label: 'Day Number', type: 'number', required: true, aliases: ['day #', 'day no', 'shoot day', 'day'] },
    { key: 'scenes', label: 'Scenes', type: 'string', required: false, aliases: ['scene list', 'scenes to shoot', 'scene numbers'], defaultValue: '' },
    { key: 'location', label: 'Location', type: 'string', required: false, aliases: ['loc', 'place', 'set', 'where'], defaultValue: '' },
    { key: 'callTime', label: 'Call Time', type: 'string', required: false, aliases: ['call', 'start time', 'crew call'], defaultValue: '' },
    { key: 'wrapTime', label: 'Wrap Time', type: 'string', required: false, aliases: ['wrap', 'end time', 'estimated wrap'], defaultValue: '' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
  ],
  exampleRow: { date: '2025-03-15', dayNumber: '1', scenes: '1, 2, 5', location: 'Studio A', callTime: '7:00 AM', wrapTime: '7:00 PM', notes: '' },
};

export const BUDGET_ITEM_CONFIG: EntityConfig = {
  key: 'budget',
  label: 'Budget Items',
  description: 'Budget line items with categories, estimates, and actuals',
  addMethod: 'addBudgetItem',
  fields: [
    { key: 'category', label: 'Category', type: 'enum', required: true,
      enumValues: ['talent', 'crew', 'equipment', 'locations', 'production-design', 'post-production', 'music', 'marketing', 'legal', 'insurance', 'catering', 'transport', 'contingency', 'other'],
      aliases: ['budget category', 'dept', 'type', 'account'],
      defaultValue: 'other',
    },
    { key: 'description', label: 'Description', type: 'string', required: true, aliases: ['desc', 'item', 'line item', 'name', 'expense'] },
    { key: 'estimated', label: 'Estimated', type: 'number', required: false, aliases: ['estimate', 'est', 'budget', 'budgeted', 'planned cost'], defaultValue: 0 },
    { key: 'actual', label: 'Actual', type: 'number', required: false, aliases: ['actual cost', 'spent', 'real cost', 'cost'], defaultValue: 0 },
    { key: 'vendor', label: 'Vendor', type: 'string', required: false, aliases: ['supplier', 'provider', 'company', 'payee'], defaultValue: '' },
    { key: 'paid', label: 'Paid', type: 'boolean', required: false, aliases: ['is paid', 'payment status', 'settled'], defaultValue: false },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
  ],
  exampleRow: { category: 'equipment', description: 'Camera rental - Alexa Mini', estimated: '5000', actual: '4800', vendor: 'Panavision', paid: 'yes', notes: '3-week rental' },
};

export const LOCATION_CONFIG: EntityConfig = {
  key: 'locations',
  label: 'Locations',
  description: 'Location scouts with addresses, contacts, and permit info',
  addMethod: 'addLocation',
  fields: [
    { key: 'name', label: 'Location Name', type: 'string', required: true, aliases: ['location', 'place', 'site', 'venue'] },
    { key: 'address', label: 'Address', type: 'string', required: false, aliases: ['addr', 'street address', 'location address'], defaultValue: '' },
    { key: 'contactName', label: 'Contact Name', type: 'string', required: false, aliases: ['contact', 'contact person', 'owner', 'manager'], defaultValue: '' },
    { key: 'contactPhone', label: 'Contact Phone', type: 'string', required: false, aliases: ['contact phone', 'phone', 'tel'], defaultValue: '' },
    { key: 'permitRequired', label: 'Permit Required', type: 'boolean', required: false, aliases: ['permit needed', 'needs permit', 'permit'], defaultValue: false },
    { key: 'permitStatus', label: 'Permit Status', type: 'string', required: false, aliases: ['permit info'], defaultValue: '' },
    { key: 'parkingNotes', label: 'Parking Notes', type: 'string', required: false, aliases: ['parking', 'parking info'], defaultValue: '' },
    { key: 'powerAvailable', label: 'Power Available', type: 'boolean', required: false, aliases: ['power', 'electricity', 'has power'], defaultValue: false },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments', 'details'], defaultValue: '' },
    { key: 'rating', label: 'Rating', type: 'number', required: false, aliases: ['score', 'stars'], defaultValue: 0 },
    { key: 'scenes', label: 'Scenes', type: 'string[]', required: false, aliases: ['scene list', 'scene numbers', 'used in scenes'], defaultValue: [] },
  ],
  exampleRow: { name: 'Abandoned Warehouse', address: '123 Industrial Ave', contactName: 'Mike Wilson', contactPhone: '555-0456', permitRequired: 'yes', permitStatus: 'Approved', parkingNotes: 'Street parking', powerAvailable: 'yes', notes: 'Great natural light', rating: '4', scenes: '3, 7, 12' },
};

export const SCENE_BREAKDOWN_CONFIG: EntityConfig = {
  key: 'sceneBreakdowns',
  label: 'Script Breakdown',
  description: 'Scene breakdowns with cast, props, wardrobe, and equipment',
  addMethod: 'addBreakdown',
  fields: [
    { key: 'sceneNumber', label: 'Scene Number', type: 'number', required: true, aliases: ['scene', 'scene #', 'sc'] },
    { key: 'sceneName', label: 'Scene Name', type: 'string', required: true, aliases: ['scene title', 'name', 'title'] },
    { key: 'intExt', label: 'INT/EXT', type: 'enum', required: false, enumValues: ['INT', 'EXT', 'INT/EXT'], aliases: ['interior exterior', 'int ext', 'ie'], defaultValue: 'INT' },
    { key: 'timeOfDay', label: 'Time of Day', type: 'enum', required: false, enumValues: ['day', 'night', 'dawn', 'dusk', 'magic-hour'], aliases: ['tod', 'time', 'day night'], defaultValue: 'day' },
    { key: 'location', label: 'Location', type: 'string', required: false, aliases: ['loc', 'set', 'place'], defaultValue: '' },
    { key: 'cast', label: 'Cast', type: 'string[]', required: false, aliases: ['actors', 'talent', 'characters'], defaultValue: [] },
    { key: 'extras', label: 'Extras', type: 'string', required: false, aliases: ['background', 'bg', 'background actors'], defaultValue: '' },
    { key: 'props', label: 'Props', type: 'string[]', required: false, aliases: ['properties', 'prop list'], defaultValue: [] },
    { key: 'wardrobe', label: 'Wardrobe', type: 'string[]', required: false, aliases: ['costumes', 'costume', 'wardrobe items'], defaultValue: [] },
    { key: 'specialEquipment', label: 'Special Equipment', type: 'string[]', required: false, aliases: ['equipment', 'special', 'sfx equipment', 'gear'], defaultValue: [] },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
    { key: 'pageCount', label: 'Page Count', type: 'string', required: false, aliases: ['pages', 'page length', 'length'], defaultValue: '' },
  ],
  exampleRow: { sceneNumber: '1', sceneName: 'The Arrival', intExt: 'EXT', timeOfDay: 'day', location: 'House exterior', cast: 'John, Sarah', extras: '5 pedestrians', props: 'suitcase, car keys', wardrobe: 'business suit, summer dress', specialEquipment: 'drone', notes: '', pageCount: '2 3/8' },
};

export const CAST_MEMBER_CONFIG: EntityConfig = {
  key: 'cast',
  label: 'Cast Members',
  description: 'Actors, characters, and contact information',
  addMethod: 'addCastMember',
  fields: [
    { key: 'actorName', label: 'Actor Name', type: 'string', required: true, aliases: ['actor', 'performer', 'talent name', 'name'] },
    { key: 'characterName', label: 'Character Name', type: 'string', required: true, aliases: ['character', 'role', 'part'] },
    { key: 'characterDescription', label: 'Character Description', type: 'string', required: false, aliases: ['character desc', 'description', 'char description'], defaultValue: '' },
    { key: 'status', label: 'Status', type: 'enum', required: false,
      enumValues: ['confirmed', 'in-talks', 'auditioned', 'wishlist', 'wrapped'],
      aliases: ['casting status', 'cast status'],
      defaultValue: 'confirmed',
    },
    { key: 'email', label: 'Email', type: 'string', required: false, aliases: ['email address', 'e-mail'], defaultValue: '' },
    { key: 'phone', label: 'Phone', type: 'string', required: false, aliases: ['phone number', 'tel', 'mobile'], defaultValue: '' },
    { key: 'agentName', label: 'Agent Name', type: 'string', required: false, aliases: ['agent', 'rep', 'representative', 'manager'], defaultValue: '' },
    { key: 'agentContact', label: 'Agent Contact', type: 'string', required: false, aliases: ['agent email', 'agent phone', 'rep contact'], defaultValue: '' },
    { key: 'scenes', label: 'Scenes', type: 'number[]', required: false, aliases: ['scene numbers', 'in scenes', 'scene list'], defaultValue: [] },
    { key: 'availability', label: 'Availability', type: 'string', required: false, aliases: ['available dates', 'schedule', 'avail'], defaultValue: '' },
    { key: 'performanceNotes', label: 'Performance Notes', type: 'string', required: false, aliases: ['acting notes', 'director notes', 'notes'], defaultValue: '' },
    { key: 'costumeNotes', label: 'Costume Notes', type: 'string', required: false, aliases: ['wardrobe notes', 'costume'], defaultValue: '' },
  ],
  exampleRow: { actorName: 'Jane Doe', characterName: 'Sarah Mitchell', characterDescription: 'Lead protagonist, late 30s', status: 'confirmed', email: 'jane@talent.com', phone: '555-0789', agentName: 'Bob at CAA', agentContact: 'bob@caa.com', scenes: '1, 3, 5, 8', availability: 'March 1-30', performanceNotes: '', costumeNotes: '' },
};

export const VFX_SHOT_CONFIG: EntityConfig = {
  key: 'vfx',
  label: 'VFX Shots',
  description: 'Visual effects shots with complexity, status, and vendor info',
  addMethod: 'addVFXShot',
  fields: [
    { key: 'sceneNumber', label: 'Scene Number', type: 'number', required: true, aliases: ['scene', 'scene #', 'sc'] },
    { key: 'shotNumber', label: 'Shot Number', type: 'string', required: true, aliases: ['shot', 'shot #', 'vfx shot'] },
    { key: 'description', label: 'Description', type: 'string', required: true, aliases: ['desc', 'vfx description', 'effect', 'details'] },
    { key: 'complexity', label: 'Complexity', type: 'enum', required: false, enumValues: ['simple', 'moderate', 'complex', 'hero'], aliases: ['level', 'difficulty'], defaultValue: 'moderate' },
    { key: 'status', label: 'Status', type: 'enum', required: false, enumValues: ['pending', 'in-progress', 'review', 'approved', 'final'], aliases: ['vfx status', 'progress'], defaultValue: 'pending' },
    { key: 'vendor', label: 'Vendor', type: 'string', required: false, aliases: ['vfx vendor', 'studio', 'house', 'company'], defaultValue: '' },
    { key: 'deadline', label: 'Deadline', type: 'date', required: false, aliases: ['due date', 'due', 'delivery date'], defaultValue: '' },
    { key: 'estimatedCost', label: 'Estimated Cost', type: 'number', required: false, aliases: ['cost', 'estimate', 'price', 'budget'], defaultValue: 0 },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
  ],
  exampleRow: { sceneNumber: '5', shotNumber: '5B', description: 'Wire removal for stunt', complexity: 'moderate', status: 'pending', vendor: 'ILM', deadline: '2025-04-15', estimatedCost: '3000', notes: '' },
};

export const FESTIVAL_CONFIG: EntityConfig = {
  key: 'festivals',
  label: 'Festival Submissions',
  description: 'Film festival submissions with deadlines, fees, and status',
  addMethod: 'addFestival',
  fields: [
    { key: 'festivalName', label: 'Festival Name', type: 'string', required: true, aliases: ['festival', 'name', 'event'] },
    { key: 'location', label: 'Location', type: 'string', required: false, aliases: ['city', 'venue', 'where'], defaultValue: '' },
    { key: 'deadline', label: 'Deadline', type: 'date', required: false, aliases: ['submission deadline', 'due date', 'due'], defaultValue: '' },
    { key: 'submissionDate', label: 'Submission Date', type: 'date', required: false, aliases: ['submitted', 'date submitted', 'submit date'], defaultValue: '' },
    { key: 'fee', label: 'Fee', type: 'number', required: false, aliases: ['submission fee', 'cost', 'entry fee', 'price'], defaultValue: 0 },
    { key: 'status', label: 'Status', type: 'enum', required: false,
      enumValues: ['researching', 'submitted', 'accepted', 'rejected', 'screening', 'awarded'],
      aliases: ['submission status'],
      defaultValue: 'researching',
    },
    { key: 'category', label: 'Category', type: 'string', required: false, aliases: ['submission category', 'section', 'program'], defaultValue: '' },
    { key: 'platformUrl', label: 'Platform URL', type: 'string', required: false, aliases: ['url', 'link', 'website', 'submission link'], defaultValue: '' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
    { key: 'notificationDate', label: 'Notification Date', type: 'date', required: false, aliases: ['notification', 'results date', 'decision date'], defaultValue: '' },
  ],
  exampleRow: { festivalName: 'Sundance Film Festival', location: 'Park City, Utah', deadline: '2025-09-15', submissionDate: '', fee: '75', status: 'researching', category: 'Short Film', platformUrl: 'https://filmfreeway.com/sundance', notes: '', notificationDate: '2025-12-01' },
};

export const TIME_ENTRY_CONFIG: EntityConfig = {
  key: 'timeEntries',
  label: 'Time Entries',
  description: 'Hours tracking with call/wrap times and overtime',
  addMethod: 'addTimeEntry',
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true, aliases: ['work date', 'day', 'when'] },
    { key: 'department', label: 'Department', type: 'enum', required: false,
      enumValues: ['direction', 'camera', 'sound', 'art', 'lighting', 'production', 'talent', 'postProduction'],
      aliases: ['dept', 'team'],
    },
    { key: 'callTime', label: 'Call Time', type: 'string', required: false, aliases: ['call', 'start', 'in'], defaultValue: '' },
    { key: 'wrapTime', label: 'Wrap Time', type: 'string', required: false, aliases: ['wrap', 'end', 'out'], defaultValue: '' },
    { key: 'lunchStart', label: 'Lunch Start', type: 'string', required: false, aliases: ['lunch out', 'meal start'], defaultValue: '' },
    { key: 'lunchEnd', label: 'Lunch End', type: 'string', required: false, aliases: ['lunch in', 'meal end'], defaultValue: '' },
    { key: 'scheduledHours', label: 'Scheduled Hours', type: 'number', required: false, aliases: ['planned hours', 'scheduled'], defaultValue: 0 },
    { key: 'actualHours', label: 'Actual Hours', type: 'number', required: false, aliases: ['worked hours', 'actual', 'total hours'], defaultValue: 0 },
    { key: 'overtimeHours', label: 'Overtime Hours', type: 'number', required: false, aliases: ['ot hours', 'overtime', 'ot'], defaultValue: 0 },
    { key: 'rate', label: 'Rate', type: 'number', required: false, aliases: ['hourly rate', 'pay rate', 'day rate'], defaultValue: 0 },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
  ],
  exampleRow: { date: '2025-03-15', department: 'camera', callTime: '7:00 AM', wrapTime: '8:00 PM', lunchStart: '1:00 PM', lunchEnd: '2:00 PM', scheduledHours: '12', actualHours: '12', overtimeHours: '0', rate: '500', notes: '' },
};

export const SCRIPT_SIDE_CONFIG: EntityConfig = {
  key: 'scriptSides',
  label: 'Script Sides',
  description: 'Daily shooting pages with scene info and shoot dates',
  addMethod: 'addScriptSide',
  fields: [
    { key: 'sceneNumber', label: 'Scene Number', type: 'number', required: true, aliases: ['scene', 'scene #', 'sc'] },
    { key: 'sceneHeader', label: 'Scene Header', type: 'string', required: true, aliases: ['slug line', 'scene heading', 'header', 'slugline'] },
    { key: 'pageStart', label: 'Page Start', type: 'string', required: false, aliases: ['start page', 'from page'], defaultValue: '' },
    { key: 'pageEnd', label: 'Page End', type: 'string', required: false, aliases: ['end page', 'to page'], defaultValue: '' },
    { key: 'pageCount', label: 'Page Count', type: 'number', required: false, aliases: ['pages', 'length'], defaultValue: 0 },
    { key: 'shootDate', label: 'Shoot Date', type: 'date', required: false, aliases: ['date', 'shooting date'], defaultValue: '' },
    { key: 'status', label: 'Status', type: 'enum', required: false,
      enumValues: ['upcoming', 'shooting-today', 'completed', 'revised'],
      aliases: ['side status'],
      defaultValue: 'upcoming',
    },
    { key: 'synopsis', label: 'Synopsis', type: 'string', required: false, aliases: ['summary', 'description', 'scene summary'], defaultValue: '' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments'], defaultValue: '' },
  ],
  exampleRow: { sceneNumber: '1', sceneHeader: 'INT. OFFICE - DAY', pageStart: '1', pageEnd: '3', pageCount: '2.5', shootDate: '2025-03-15', status: 'upcoming', synopsis: 'Sarah arrives at the office', notes: '' },
};

export const CONTINUITY_NOTE_CONFIG: EntityConfig = {
  key: 'continuity',
  label: 'Continuity Notes',
  description: 'Script supervisor continuity notes by scene and shot',
  addMethod: 'addContinuityNote',
  fields: [
    { key: 'sceneNumber', label: 'Scene Number', type: 'number', required: true, aliases: ['scene', 'scene #', 'sc'] },
    { key: 'shotNumber', label: 'Shot Number', type: 'string', required: true, aliases: ['shot', 'shot #'] },
    { key: 'description', label: 'Description', type: 'string', required: true, aliases: ['desc', 'what', 'continuity item'] },
    { key: 'details', label: 'Details', type: 'string', required: false, aliases: ['detail', 'specifics', 'info'], defaultValue: '' },
  ],
  exampleRow: { sceneNumber: '3', shotNumber: '3A', description: 'Coffee cup position', details: 'Cup in left hand, half full, white mug' },
};

export const WRAP_REPORT_CONFIG: EntityConfig = {
  key: 'wrapReports',
  label: 'Wrap Reports',
  description: 'Daily wrap summaries with shot counts and schedule adherence',
  addMethod: 'addWrapReport',
  fields: [
    { key: 'dayNumber', label: 'Day Number', type: 'number', required: true, aliases: ['day #', 'day', 'shoot day'] },
    { key: 'date', label: 'Date', type: 'date', required: true, aliases: ['shoot date', 'when'] },
    { key: 'callTime', label: 'Call Time', type: 'string', required: false, aliases: ['call', 'crew call'], defaultValue: '' },
    { key: 'actualWrap', label: 'Actual Wrap', type: 'string', required: false, aliases: ['wrap time', 'wrapped at'], defaultValue: '' },
    { key: 'scheduledWrap', label: 'Scheduled Wrap', type: 'string', required: false, aliases: ['planned wrap', 'est wrap'], defaultValue: '' },
    { key: 'scenesScheduled', label: 'Scenes Scheduled', type: 'string', required: false, aliases: ['planned scenes'], defaultValue: '' },
    { key: 'scenesCompleted', label: 'Scenes Completed', type: 'string', required: false, aliases: ['completed scenes', 'scenes done'], defaultValue: '' },
    { key: 'shotsPlanned', label: 'Shots Planned', type: 'number', required: false, aliases: ['planned shots', 'shot count planned'], defaultValue: 0 },
    { key: 'shotsCompleted', label: 'Shots Completed', type: 'number', required: false, aliases: ['completed shots', 'shots done'], defaultValue: 0 },
    { key: 'totalTakes', label: 'Total Takes', type: 'number', required: false, aliases: ['takes', 'take count'], defaultValue: 0 },
    { key: 'circledTakes', label: 'Circled Takes', type: 'number', required: false, aliases: ['circled', 'selects'], defaultValue: 0 },
    { key: 'overtimeMinutes', label: 'Overtime Minutes', type: 'number', required: false, aliases: ['overtime', 'ot minutes', 'ot'], defaultValue: 0 },
    { key: 'weatherConditions', label: 'Weather', type: 'string', required: false, aliases: ['weather', 'conditions'], defaultValue: '' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, aliases: ['note', 'comments', 'remarks'], defaultValue: '' },
  ],
  exampleRow: { dayNumber: '1', date: '2025-03-15', callTime: '7:00 AM', actualWrap: '7:30 PM', scheduledWrap: '7:00 PM', scenesScheduled: '1, 2, 3', scenesCompleted: '1, 2', shotsPlanned: '15', shotsCompleted: '12', totalTakes: '48', circledTakes: '15', overtimeMinutes: '30', weatherConditions: 'Sunny, 72°F', notes: 'Lost time to equipment issue' },
};

// ─── Registry ──────────────────────────────────────────────────────

/**
 * All importable entity configurations, keyed by entity type.
 * Used by the import UI to look up field schemas and by AI import to build prompts.
 */
export const IMPORT_REGISTRY: Record<string, EntityConfig> = {
  crew: CREW_MEMBER_CONFIG,
  shots: SHOT_CONFIG,
  schedule: SCHEDULE_CONFIG,
  budget: BUDGET_ITEM_CONFIG,
  locations: LOCATION_CONFIG,
  sceneBreakdowns: SCENE_BREAKDOWN_CONFIG,
  cast: CAST_MEMBER_CONFIG,
  vfx: VFX_SHOT_CONFIG,
  festivals: FESTIVAL_CONFIG,
  timeEntries: TIME_ENTRY_CONFIG,
  scriptSides: SCRIPT_SIDE_CONFIG,
  continuity: CONTINUITY_NOTE_CONFIG,
  wrapReports: WRAP_REPORT_CONFIG,
};

/**
 * Get the entity config for a given entity key.
 * Returns null if the entity type is not importable.
 */
export function getEntityConfig(entityKey: string): EntityConfig | null {
  return IMPORT_REGISTRY[entityKey] ?? null;
}

/**
 * Get a list of all importable entity types (for showing in a picker UI).
 */
export function getImportableEntities(): Array<{ key: string; label: string; description: string }> {
  return Object.values(IMPORT_REGISTRY).map(config => ({
    key: config.key,
    label: config.label,
    description: config.description,
  }));
}
