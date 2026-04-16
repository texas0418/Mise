import { Project, Shot, ScheduleDay, CrewMember, Take, SceneBreakdown, LocationScout, BudgetItem, ContinuityNote, VFXShot, FestivalSubmission, ProductionNote, MoodBoardItem, DirectorCredit, ShotReference, WrapReport, LocationWeather, BlockingNote, ColorReference, TimeEntry, ScriptSide, CastMember, LookbookItem, DirectorStatement, SceneSelect, DirectorMessage } from '@/types';

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'The Last Light',
    logline: 'A lighthouse keeper discovers that the light she tends is the only thing keeping an ancient darkness at bay.',
    genre: 'Thriller',
    status: 'production',
    format: 'Short Film',
    createdAt: '2025-12-01',
    imageUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&q=80',
    budget: 45000,
    director: 'Maya Chen',
    producer: 'Nina Petrov',
  },
  {
    id: 'b8e1f2a3-c4d5-6789-bcde-f01234567891',
    title: 'Echoes of Tomorrow',
    logline: 'In a city where memories can be traded, a young archivist stumbles upon a memory that changes everything.',
    genre: 'Sci-Fi Drama',
    status: 'pre-production',
    format: 'Feature Film',
    createdAt: '2026-01-15',
    imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
    budget: 250000,
    director: 'Maya Chen',
    producer: 'Alex Roth',
  },
  {
    id: 'c9f2a3b4-d5e6-789a-cdef-012345678902',
    title: 'Paper Cranes',
    logline: 'Two strangers connected through origami left in public places find their way to each other.',
    genre: 'Romance',
    status: 'development',
    format: 'Short Film',
    createdAt: '2026-02-10',
    imageUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&q=80',
    budget: 15000,
  },
];

export const SAMPLE_SHOTS: Shot[] = [
  { id: 's1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', type: 'establishing', movement: 'static', lens: '24mm', description: 'Exterior lighthouse at dusk, waves crashing', notes: 'Golden hour only', status: 'approved' },
  { id: 's2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1B', type: 'wide', movement: 'crane', lens: '35mm', description: 'Pull back from lighthouse door to reveal coastline', notes: 'VFX cleanup needed for horizon', status: 'shot' },
  { id: 's3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 2, shotNumber: '2A', type: 'medium', movement: 'steadicam', lens: '50mm', description: 'Follow keeper climbing spiral stairs', notes: 'Practical lighting from window slats', status: 'planned' },
  { id: 's4', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 2, shotNumber: '2B', type: 'close-up', movement: 'static', lens: '85mm', description: 'Keeper hands turning on the light mechanism', notes: 'Insert detail of worn hands', status: 'planned' },
  { id: 's5', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, shotNumber: '3A', type: 'pov', movement: 'handheld', lens: '35mm', description: 'POV looking out from the top of the lighthouse', notes: 'Darkness encroaching from sea', status: 'ready' },
  { id: 's6', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, shotNumber: '3B', type: 'over-shoulder', movement: 'dolly', lens: '50mm', description: 'OTS keeper watching the darkness approach', notes: 'Slow push in, build tension', status: 'planned' },
];

export const SAMPLE_SCHEDULE: ScheduleDay[] = [
  { id: 'd1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', date: '2026-03-15', dayNumber: 1, scenes: 'Sc. 1, 5, 8', location: 'Point Reyes Lighthouse', callTime: '5:30 AM', wrapTime: '7:00 PM', notes: 'Golden hour at 6:15 PM. All exterior scenes.' },
  { id: 'd2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', date: '2026-03-16', dayNumber: 2, scenes: 'Sc. 2, 3', location: 'Lighthouse Interior (Stage B)', callTime: '7:00 AM', wrapTime: '6:00 PM', notes: 'Spiral staircase rig needed. Check with grip dept.' },
  { id: 'd3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', date: '2026-03-17', dayNumber: 3, scenes: 'Sc. 4, 6, 7', location: 'Coastal Cliff / Beach', callTime: '6:00 AM', wrapTime: '5:00 PM', notes: 'Weather contingency: move to Sc. 9 studio work.' },
];

export const SAMPLE_CREW: CrewMember[] = [
  { id: 'c1', name: 'Maya Chen', role: 'Director', department: 'direction', phone: '+1 555-0101', email: 'maya@lastlight.film' },
  { id: 'c2', name: 'James Okafor', role: 'Director of Photography', department: 'camera', phone: '+1 555-0102', email: 'james@lastlight.film' },
  { id: 'c3', name: 'Priya Sharma', role: '1st Assistant Director', department: 'direction', phone: '+1 555-0103', email: 'priya@lastlight.film' },
  { id: 'c4', name: 'Leo Martinez', role: 'Sound Designer', department: 'sound', phone: '+1 555-0104', email: 'leo@lastlight.film' },
  { id: 'c5', name: 'Sarah Kim', role: 'Production Designer', department: 'art', phone: '+1 555-0105', email: 'sarah@lastlight.film' },
  { id: 'c6', name: 'Tom Hughes', role: 'Gaffer', department: 'lighting', phone: '+1 555-0106', email: 'tom@lastlight.film' },
  { id: 'c7', name: 'Nina Petrov', role: 'Line Producer', department: 'production', phone: '+1 555-0107', email: 'nina@lastlight.film' },
  { id: 'c8', name: 'Elena Voss', role: 'Lead Actress', department: 'talent', phone: '+1 555-0108', email: 'elena.agent@talent.com' },
];

export const SAMPLE_TAKES: Take[] = [
  { id: 't1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', takeNumber: 1, isCircled: false, isNG: false, notes: 'Good framing, timing off', timestamp: '2026-03-15T06:45:00' },
  { id: 't2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', takeNumber: 2, isCircled: true, isNG: false, notes: 'Perfect. Print this.', timestamp: '2026-03-15T06:52:00' },
  { id: 't3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', takeNumber: 3, isCircled: false, isNG: true, notes: 'Boom in frame', timestamp: '2026-03-15T06:58:00' },
];

export const SAMPLE_SCENE_BREAKDOWNS: SceneBreakdown[] = [
  {
    id: 'sb1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, sceneName: 'The Lighthouse at Dusk',
    intExt: 'EXT', timeOfDay: 'dusk', location: 'Point Reyes Lighthouse',
    cast: ['Elena Voss'], extras: '2 fishermen in background',
    props: ['Lantern', 'Rope coil', 'Journal'], wardrobe: ['Weathered overcoat', 'Wool scarf'],
    specialEquipment: ['Crane', 'Wind machine'],
    notes: 'Need golden hour. Backup: magic hour composite.', pageCount: '2 3/8',
  },
  {
    id: 'sb2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 2, sceneName: 'Climbing the Tower',
    intExt: 'INT', timeOfDay: 'night', location: 'Lighthouse Interior (Stage B)',
    cast: ['Elena Voss'], extras: '',
    props: ['Oil lamp', 'Worn key ring'], wardrobe: ['Same overcoat from Sc.1'],
    specialEquipment: ['Steadicam rig', 'Practical window lights'],
    notes: 'Spiral staircase. Safety harness required.', pageCount: '1 5/8',
  },
  {
    id: 'sb3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, sceneName: 'The View From Above',
    intExt: 'INT/EXT', timeOfDay: 'night', location: 'Lighthouse Top / Green Screen',
    cast: ['Elena Voss'], extras: '',
    props: ['Binoculars', 'Light mechanism controls'], wardrobe: ['Same overcoat'],
    specialEquipment: ['Green screen panels', 'LED volume'],
    notes: 'VFX plate for sea darkness. Shoot plate separately day 1.', pageCount: '3 1/8',
  },
];

export const SAMPLE_LOCATIONS: LocationScout[] = [
  {
    id: 'loc1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Point Reyes Lighthouse',
    address: 'Point Reyes National Seashore, CA 94956',
    contactName: 'Park Ranger Davis',
    contactPhone: '+1 555-0201',
    permitRequired: true,
    permitStatus: 'Approved',
    parkingNotes: 'Crew parking 0.3mi from set. Shuttle needed.',
    powerAvailable: false,
    notes: 'Generator required. No drone zone. Check tide schedule.',
    rating: 5,
    photoUrls: [],
    scenes: ['1', '5', '8'],
    latitude: 37.9963,
    longitude: -123.0247,
  },
  {
    id: 'loc2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Stage B - Lighthouse Interior',
    address: '450 Industrial Blvd, San Rafael, CA',
    contactName: 'Mike from Stage Mgmt',
    contactPhone: '+1 555-0202',
    permitRequired: false,
    permitStatus: 'N/A',
    parkingNotes: 'Full lot available. Load-in dock on east side.',
    powerAvailable: true,
    notes: 'Build spiral staircase set piece. 2 day build.',
    rating: 4,
    photoUrls: [],
    scenes: ['2', '3'],
    latitude: 37.9735,
    longitude: -122.5311,
  },
];

export const SAMPLE_BUDGET: BudgetItem[] = [
  { id: 'b1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'talent', description: 'Elena Voss - Lead', estimated: 8000, actual: 8000, notes: 'SAG-AFTRA short film agreement', paid: true },
  { id: 'b2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'crew', description: 'DP - James Okafor (3 days)', estimated: 4500, actual: 4500, notes: '', paid: true },
  { id: 'b3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'equipment', description: 'Camera package (ARRI Alexa Mini)', estimated: 3600, actual: 3200, notes: 'Got indie rate from rental house', paid: true },
  { id: 'b4', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'locations', description: 'Point Reyes permit + fees', estimated: 1200, actual: 1200, notes: 'Park filming permit', paid: true },
  { id: 'b5', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'locations', description: 'Stage B rental (5 days)', estimated: 5000, actual: 5000, notes: 'Includes 2 days build + 2 days shoot + 1 day strike', paid: false },
  { id: 'b6', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'catering', description: 'Craft services (3 shoot days)', estimated: 2400, actual: 1800, notes: 'Local caterer, saved on day 3', paid: true },
  { id: 'b7', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'post-production', description: 'Color grading', estimated: 3000, actual: 0, notes: 'Scheduled for April', paid: false },
  { id: 'b8', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'post-production', description: 'VFX - sea darkness shots', estimated: 6000, actual: 0, notes: 'Awaiting bid from Pixel Forge', paid: false },
  { id: 'b9', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'music', description: 'Original score', estimated: 4000, actual: 0, notes: 'Composer attached: Yuki Tanaka', paid: false },
  { id: 'b10', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'insurance', description: 'Production insurance', estimated: 2000, actual: 2000, notes: 'Short-term entertainment policy', paid: true },
];

export const SAMPLE_CONTINUITY: ContinuityNote[] = [
  { id: 'cn1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', description: 'Lantern position', details: 'Lantern in left hand, held at waist height. Scarf tucked into coat on right side.', timestamp: '2026-03-15T06:50:00' },
  { id: 'cn2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1B', description: 'Hair continuity', details: 'Hair loose, blown right by wind machine. Strand across face at end of take.', timestamp: '2026-03-15T07:15:00' },
];

export const SAMPLE_VFX: VFXShot[] = [
  { id: 'vfx1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1B', description: 'Horizon cleanup - remove modern structures', complexity: 'simple', status: 'in-progress', vendor: 'Pixel Forge VFX', deadline: '2026-04-15', notes: 'Wire removal + horizon paint out', estimatedCost: 800 },
  { id: 'vfx2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, shotNumber: '3A', description: 'Darkness entity approaching from sea', complexity: 'hero', status: 'pending', vendor: 'Pixel Forge VFX', deadline: '2026-05-01', notes: 'Key hero VFX shot. Reference: Annihilation shimmer.', estimatedCost: 4000 },
  { id: 'vfx3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, shotNumber: '3B', description: 'Window reflections of darkness', complexity: 'moderate', status: 'pending', vendor: '', deadline: '2026-05-01', notes: 'Practical + CG augmentation', estimatedCost: 1200 },
];

export const SAMPLE_FESTIVALS: FestivalSubmission[] = [
  { id: 'f1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', festivalName: 'Sundance Film Festival', location: 'Park City, UT', deadline: '2026-09-15', submissionDate: '', fee: 75, status: 'researching', category: 'Short Film', platformUrl: 'https://filmfreeway.com/sundance', notes: 'Premiere requirement: World Premiere', notificationDate: '2026-12-01' },
  { id: 'f2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', festivalName: 'SXSW', location: 'Austin, TX', deadline: '2026-09-20', submissionDate: '', fee: 55, status: 'researching', category: 'Narrative Short', platformUrl: 'https://filmfreeway.com/sxsw', notes: 'Early bird deadline. Regular: Oct 15', notificationDate: '2027-01-15' },
  { id: 'f3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', festivalName: 'Palm Springs ShortFest', location: 'Palm Springs, CA', deadline: '2026-08-01', submissionDate: '', fee: 45, status: 'researching', category: 'Live Action Short', platformUrl: '', notes: 'Oscar-qualifying festival', notificationDate: '2026-10-15' },
];

export const SAMPLE_NOTES: ProductionNote[] = [
  { id: 'n1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'Director\'s Vision Statement', content: 'The Last Light is a meditation on isolation and purpose. The lighthouse is both prison and sanctuary. Visual language: Kubrickian symmetry in interior shots, Malick-inspired naturalism for exteriors. The darkness is never fully shown—only suggested. Let the audience\'s imagination do the heavy lifting.', category: 'creative', createdAt: '2025-12-15T10:00:00', updatedAt: '2026-01-20T14:30:00', pinned: true },
  { id: 'n2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'Sound Design Brief', content: 'The lighthouse itself should have a heartbeat—a low, rhythmic pulse from the light mechanism. Wind and waves are constant companions. The darkness has NO sound. Its approach is marked by the ABSENCE of natural sound. Score should be sparse, cello-driven.', category: 'creative', createdAt: '2026-01-05T09:00:00', updatedAt: '2026-01-05T09:00:00', pinned: false },
  { id: 'n3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'Day 1 Wrap Notes', content: 'Wrapped 30min early. Got all exterior coverage. Wind machine worked great for Sc.1. Elena nailed the final beat in 2 takes. Need to reshoot fisherman extras—they looked too modern. Check wardrobe.', category: 'logistics', createdAt: '2026-03-15T19:30:00', updatedAt: '2026-03-15T19:30:00', pinned: false },
];

export const SAMPLE_MOOD_BOARD: MoodBoardItem[] = [
  { id: 'mb1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'color', color: '#1a2940', label: 'Deep Ocean Blue' },
  { id: 'mb2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'color', color: '#c8a04a', label: 'Lighthouse Gold' },
  { id: 'mb3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'color', color: '#2d1b2e', label: 'The Darkness' },
  { id: 'mb4', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'color', color: '#e8d5b7', label: 'Warm Interior' },
  { id: 'mb5', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'note', note: 'Think Vilmos Zsigmond meets Roger Deakins. Natural light for exteriors, controlled practicals for interiors. Never flat, always depth.', label: 'Lighting Philosophy' },
  { id: 'mb6', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'reference', imageUrl: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400&q=80', label: 'Lighthouse Reference' },
  { id: 'mb7', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', boardName: 'Visual Tone', type: 'reference', imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80', label: 'Ocean Mood' },
];

export const SAMPLE_CREDITS: DirectorCredit[] = [
  { id: 'dc1', title: 'The Last Light', role: 'Director / Writer', year: '2026', format: 'Short Film', festival: 'In Progress', award: '', notes: 'Currently in production' },
  { id: 'dc2', title: 'Quiet Streets', role: 'Director', year: '2024', format: 'Short Film', festival: 'Tribeca Film Festival', award: 'Best Short Film', notes: 'Premiered at Tribeca 2024' },
  { id: 'dc3', title: 'Neon Lullaby', role: 'Director / Editor', year: '2023', format: 'Music Video', festival: '', award: '', notes: 'For artist Mira Lake. 2M+ views.' },
];

export const SHOT_TYPES: { label: string; value: string }[] = [
  { label: 'Wide', value: 'wide' },
  { label: 'Medium', value: 'medium' },
  { label: 'Close-Up', value: 'close-up' },
  { label: 'Extreme CU', value: 'extreme-close-up' },
  { label: 'Over Shoulder', value: 'over-shoulder' },
  { label: 'POV', value: 'pov' },
  { label: 'Aerial', value: 'aerial' },
  { label: 'Insert', value: 'insert' },
  { label: 'Two-Shot', value: 'two-shot' },
  { label: 'Establishing', value: 'establishing' },
];

export const SHOT_MOVEMENTS: { label: string; value: string }[] = [
  { label: 'Static', value: 'static' },
  { label: 'Pan', value: 'pan' },
  { label: 'Tilt', value: 'tilt' },
  { label: 'Dolly', value: 'dolly' },
  { label: 'Tracking', value: 'tracking' },
  { label: 'Crane', value: 'crane' },
  { label: 'Handheld', value: 'handheld' },
  { label: 'Steadicam', value: 'steadicam' },
  { label: 'Zoom', value: 'zoom' },
];

export const DEPARTMENTS: { label: string; value: string }[] = [
  { label: 'Direction', value: 'direction' },
  { label: 'Camera', value: 'camera' },
  { label: 'Sound', value: 'sound' },
  { label: 'Art', value: 'art' },
  { label: 'Lighting', value: 'lighting' },
  { label: 'Production', value: 'production' },
  { label: 'Talent', value: 'talent' },
  { label: 'Post-Production', value: 'postProduction' },
];

export const PROJECT_STATUSES: { label: string; value: string }[] = [
  { label: 'Development', value: 'development' },
  { label: 'Pre-Production', value: 'pre-production' },
  { label: 'Production', value: 'production' },
  { label: 'Post-Production', value: 'post-production' },
  { label: 'Completed', value: 'completed' },
];

export const GENRES: string[] = [
  'Drama', 'Thriller', 'Sci-Fi', 'Horror', 'Comedy', 'Romance',
  'Documentary', 'Animation', 'Action', 'Experimental', 'Sci-Fi Drama',
  'Dark Comedy', 'Musical', 'Mystery', 'Western',
];

export const BUDGET_CATEGORIES: { label: string; value: string }[] = [
  { label: 'Talent', value: 'talent' },
  { label: 'Crew', value: 'crew' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Locations', value: 'locations' },
  { label: 'Production Design', value: 'production-design' },
  { label: 'Post-Production', value: 'post-production' },
  { label: 'Music', value: 'music' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Legal', value: 'legal' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Catering', value: 'catering' },
  { label: 'Transport', value: 'transport' },
  { label: 'Contingency', value: 'contingency' },
  { label: 'Other', value: 'other' },
];

export const SAMPLE_SHOT_REFERENCES: ShotReference[] = [
  { id: 'sr1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', shotId: 's1', sceneNumber: 1, title: 'Lighthouse establishing - Shutter Island ref', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', shotType: 'establishing', lightingStyle: 'Natural dusk', notes: 'Low angle, golden hour backlight. Reference Deakins.', tags: ['establishing', 'golden-hour', 'wide'] },
  { id: 'sr2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', shotId: 's4', sceneNumber: 2, title: 'Hands detail insert - Tree of Life', imageUrl: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=400&q=80', shotType: 'insert', lightingStyle: 'Practical warm', notes: 'Shallow DOF, warm practicals. Chivo style.', tags: ['close-up', 'insert', 'warm'] },
  { id: 'sr3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, title: 'Darkness approaching sea - Annihilation', imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80', shotType: 'wide', lightingStyle: 'Desaturated', notes: 'VFX reference for darkness entity. Shimmer effect.', tags: ['vfx', 'wide', 'atmosphere'] },
];

export const SAMPLE_WRAP_REPORTS: WrapReport[] = [
  {
    id: 'wr1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', scheduleDayId: 'd1', dayNumber: 1, date: '2026-03-15',
    callTime: '5:30 AM', actualWrap: '6:30 PM', scheduledWrap: '7:00 PM',
    scenesScheduled: 'Sc. 1, 5, 8', scenesCompleted: 'Sc. 1, 5',
    shotsPlanned: 8, shotsCompleted: 6, totalTakes: 18, circledTakes: 8, ngTakes: 3,
    pagesScheduled: '5 2/8', pagesCompleted: '3 6/8', overtimeMinutes: 0,
    notes: 'Wrapped 30min early. Sc.8 pushed to day 3 due to tide. Great golden hour footage.',
    safetyIncidents: 'None', weatherConditions: 'Clear, 62°F, light wind',
    createdAt: '2026-03-15T19:00:00'
  },
];

export const SAMPLE_LOCATION_WEATHER: LocationWeather[] = [
  { id: 'lw1', locationId: 'loc1', date: '2026-03-15', sunrise: '7:18 AM', sunset: '7:24 PM', goldenHourAM: '7:18-7:48 AM', goldenHourPM: '6:54-7:24 PM', tempHigh: 62, tempLow: 48, condition: 'sunny', windSpeed: 12, humidity: 65, precipChance: 5, notes: 'Ideal for exterior shoots' },
  { id: 'lw2', locationId: 'loc1', date: '2026-03-16', sunrise: '7:16 AM', sunset: '7:25 PM', goldenHourAM: '7:16-7:46 AM', goldenHourPM: '6:55-7:25 PM', tempHigh: 58, tempLow: 45, condition: 'partly-cloudy', windSpeed: 18, humidity: 72, precipChance: 20, notes: 'Wind may be an issue for sound' },
  { id: 'lw3', locationId: 'loc1', date: '2026-03-17', sunrise: '7:15 AM', sunset: '7:26 PM', goldenHourAM: '7:15-7:45 AM', goldenHourPM: '6:56-7:26 PM', tempHigh: 55, tempLow: 42, condition: 'cloudy', windSpeed: 22, humidity: 80, precipChance: 45, notes: 'Rain contingency likely. Have cover set ready.' },
];

export const SAMPLE_BLOCKING_NOTES: BlockingNote[] = [
  {
    id: 'bn1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, title: 'Keeper approaches lighthouse',
    description: 'Elena enters frame left, walks toward lighthouse door. Pauses at step 3 to look back at sea.',
    actorPositions: 'Start: frame left edge, 20ft from door. End: at door threshold.',
    cameraPosition: 'Camera A: wide on dolly track, parallel. Camera B: low angle at door.',
    movementNotes: 'Slow, deliberate pace. Wind pushes her forward. She resists slightly.',
    notes: 'Key beat: the pause and look back. This is where she decides.',
    createdAt: '2026-03-10T14:00:00'
  },
  {
    id: 'bn2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 2, title: 'Spiral staircase climb',
    description: 'Steadicam follows Elena up 3 flights. She traces the wall with her right hand.',
    actorPositions: 'Start: bottom of stairs. End: landing before light room.',
    cameraPosition: 'Steadicam behind, slightly below. Tight on her back/shoulder.',
    movementNotes: 'Speed up gradually. By flight 3 she is almost running.',
    notes: 'Rehearse with stunt coord for safety on narrow stairs.',
    createdAt: '2026-03-10T15:00:00'
  },
];

export const SAMPLE_COLOR_REFERENCES: ColorReference[] = [
  { id: 'cr1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, name: 'Exterior Dusk', lutStyle: 'warm-film', primaryColor: '#1a2940', secondaryColor: '#c8a04a', accentColor: '#e8d5b7', contrast: 'high', saturation: 'natural', temperature: 'warm', referenceFilm: 'The Lighthouse (2019)', notes: 'Rich golden hour warmth against cool ocean blues. Slight grain.' },
  { id: 'cr2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 2, name: 'Interior Night', lutStyle: 'desaturated', primaryColor: '#1a1a2e', secondaryColor: '#8b6914', accentColor: '#4a3520', contrast: 'high', saturation: 'desaturated', temperature: 'warm', referenceFilm: 'Blade Runner 2049', notes: 'Mostly shadow. Practical oil lamp is key source. Pools of warm light.' },
  { id: 'cr3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 3, name: 'Darkness Approach', lutStyle: 'bleach-bypass', primaryColor: '#0a0a14', secondaryColor: '#2a2a3e', accentColor: '#4466aa', contrast: 'high', saturation: 'desaturated', temperature: 'cool', referenceFilm: 'Annihilation', notes: 'Almost monochrome. Blue-black. The only color is from the lighthouse light.' },
];

export const SAMPLE_TIME_ENTRIES: TimeEntry[] = [
  { id: 'te1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', scheduleDayId: 'd1', department: 'camera', date: '2026-03-15', callTime: '5:30 AM', wrapTime: '6:30 PM', lunchStart: '12:00 PM', lunchEnd: '12:30 PM', scheduledHours: 12, actualHours: 12.5, overtimeHours: 0.5, notes: 'DIT stayed extra 30min for backup' },
  { id: 'te2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', scheduleDayId: 'd1', department: 'lighting', date: '2026-03-15', callTime: '4:30 AM', wrapTime: '7:00 PM', lunchStart: '12:00 PM', lunchEnd: '12:30 PM', scheduledHours: 12, actualHours: 14, overtimeHours: 2, notes: 'Early call for pre-rig. Late wrap for strike.' },
  { id: 'te3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', scheduleDayId: 'd1', department: 'talent', date: '2026-03-15', callTime: '6:00 AM', wrapTime: '5:00 PM', lunchStart: '12:00 PM', lunchEnd: '1:00 PM', scheduledHours: 10, actualHours: 10, overtimeHours: 0, notes: '' },
];

export const LUT_STYLES: { label: string; value: string; description: string; colors: string[] }[] = [
  { label: 'Neutral', value: 'neutral', description: 'Clean, balanced. No strong color bias.', colors: ['#888888', '#aaaaaa', '#666666'] },
  { label: 'Warm Film', value: 'warm-film', description: 'Golden warmth. Classic Kodak look.', colors: ['#c8a04a', '#e8d5b7', '#8b6914'] },
  { label: 'Cool Blue', value: 'cool-blue', description: 'Steel blue tones. Night, sci-fi.', colors: ['#4a6a8a', '#2a4060', '#8ab0d4'] },
  { label: 'Desaturated', value: 'desaturated', description: 'Muted, low saturation. Drama, war.', colors: ['#7a7a7a', '#5a5a5a', '#9a9a9a'] },
  { label: 'High Contrast', value: 'high-contrast', description: 'Deep blacks, bright highlights.', colors: ['#1a1a1a', '#f0f0f0', '#808080'] },
  { label: 'Vintage', value: 'vintage', description: 'Faded, lifted blacks. 70s/80s feel.', colors: ['#8a7a5a', '#c8b090', '#5a5040'] },
  { label: 'Bleach Bypass', value: 'bleach-bypass', description: 'Silver retention. Saving Private Ryan.', colors: ['#6a6a6a', '#3a3a3a', '#a0a0a0'] },
  { label: 'Teal & Orange', value: 'teal-orange', description: 'Hollywood blockbuster look.', colors: ['#2a8080', '#e08040', '#1a5050'] },
  { label: 'Noir', value: 'noir', description: 'High contrast B&W. Shadows rule.', colors: ['#1a1a1a', '#e0e0e0', '#404040'] },
  { label: 'Pastel', value: 'pastel', description: 'Soft, airy. Wes Anderson palette.', colors: ['#c8a0a0', '#a0c8c0', '#c8c0a0'] },
];

export const LENS_DATA = [
  { focal: 14, type: 'Ultra Wide', fov: 114, use: 'Extreme wide establishing shots, landscapes' },
  { focal: 18, type: 'Ultra Wide', fov: 100, use: 'Interiors, architecture, dramatic perspectives' },
  { focal: 24, type: 'Wide', fov: 84, use: 'Establishing shots, wide coverage, walk-and-talk' },
  { focal: 28, type: 'Wide', fov: 75, use: 'Street photography look, documentary feel' },
  { focal: 35, type: 'Standard Wide', fov: 63, use: 'Most versatile. Master shots, two-shots, walking' },
  { focal: 50, type: 'Normal', fov: 47, use: 'Eye-level perspective, dialogue scenes, portraits' },
  { focal: 65, type: 'Short Tele', fov: 38, use: 'Flattering portraits, medium close-ups' },
  { focal: 85, type: 'Telephoto', fov: 29, use: 'Close-ups, beauty shots, compressed backgrounds' },
  { focal: 100, type: 'Telephoto', fov: 24, use: 'Tight close-ups, reaction shots' },
  { focal: 135, type: 'Telephoto', fov: 18, use: 'Extreme close-ups, voyeuristic feel' },
  { focal: 200, type: 'Long Tele', fov: 12, use: 'Surveillance look, extreme compression' },
];

// === SCRIPT SIDES ===

export const SAMPLE_SCRIPT_SIDES: ScriptSide[] = [
  {
    id: 'side-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1,
    sceneHeader: 'EXT. DESERT HIGHWAY - DAWN',
    pageStart: '1', pageEnd: '3', pageCount: 2.625,
    shootDate: '2025-03-15', status: 'completed',
    synopsis: 'Marcus drives alone through the desert at dawn. Voiceover establishes his inner monologue about leaving everything behind.',
    castIds: ['Marcus'], linkedShotIds: ['1', '2'],
    annotations: [
      { id: 'ann-1', text: 'Start wide on highway, slowly push in to car', type: 'camera', timestamp: '2025-03-15T07:00:00Z' },
      { id: 'ann-2', text: 'Marcus should show exhaustion but not defeat', type: 'performance', timestamp: '2025-03-15T07:15:00Z' },
    ],
    revisionColor: 'blue', revisionDate: '2025-03-10',
    notes: 'Golden hour critical — must shoot within first 30 min of sunrise',
    createdAt: '2025-03-01T10:00:00Z',
  },
  {
    id: 'side-2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 5,
    sceneHeader: "INT. ELENA'S APARTMENT - NIGHT",
    pageStart: '12', pageEnd: '14A', pageCount: 3.0,
    shootDate: '2025-03-17', status: 'shooting-today',
    synopsis: 'Elena receives the phone call about Marcus. She tries to remain composed but breaks down after hanging up.',
    castIds: ['Elena', 'Marcus (V.O.)'], linkedShotIds: ['3'],
    annotations: [
      { id: 'ann-3', text: 'Keep camera static on Elena', type: 'camera', timestamp: '2025-03-17T09:00:00Z' },
      { id: 'ann-5', text: 'Elena moves to window after the call — blocking matches Scene 22', type: 'blocking', timestamp: '2025-03-17T09:10:00Z' },
    ],
    revisionColor: 'pink', revisionDate: '2025-03-16',
    notes: 'Revised dialogue on page 13',
    createdAt: '2025-03-01T10:00:00Z',
  },
  {
    id: 'side-3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 12,
    sceneHeader: 'EXT. ROOFTOP - MAGIC HOUR',
    pageStart: '28', pageEnd: '30', pageCount: 2.25,
    shootDate: '2025-03-20', status: 'upcoming',
    synopsis: 'Marcus and Elena meet on the rooftop for the first time since the incident.',
    castIds: ['Marcus', 'Elena'], linkedShotIds: [],
    annotations: [],
    notes: 'Need to scout rooftop access by 3/18.',
    createdAt: '2025-03-01T10:00:00Z',
  },
];

// === CAST ===

export const SAMPLE_CAST: CastMember[] = [
  {
    id: 'cast-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    actorName: 'Daniel Reeves', characterName: 'Marcus',
    characterDescription: 'A man in his late 30s running from a past he can\'t outrun. Quiet intensity.',
    status: 'confirmed',
    headshot: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
    email: 'daniel.reeves@talent.com', phone: '(310) 555-0142',
    agentName: 'Lisa Park', agentContact: 'lpark@caatalent.com',
    scenes: [1, 5, 8, 12, 15, 18, 22],
    shootDays: ['2025-03-15', '2025-03-17', '2025-03-16', '2025-03-20'],
    availability: 'Full availability March 10–30.',
    performanceNotes: 'Strongest in understated moments. Best takes usually come after take 3.',
    preferredTakes: 'Sc.1: Take 4. Sc.5: Take 2.',
    costumeNotes: 'Worn leather jacket, faded jeans, desert boots.',
    createdAt: '2025-02-15T10:00:00Z',
  },
  {
    id: 'cast-2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    actorName: 'Sofia Mendes', characterName: 'Elena',
    characterDescription: 'Marcus\'s ex-wife. Strong, composed exterior masking deep hurt. Mid-30s.',
    status: 'confirmed',
    headshot: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    email: 'sofia.m@unitedtalent.com',
    agentName: 'James Wu',
    scenes: [5, 12, 15, 22],
    shootDays: ['2025-03-17', '2025-03-20', '2025-03-22', '2025-03-26'],
    availability: 'Available March 15–28.',
    performanceNotes: 'Incredible with micro-expressions. Camera loves her in close-up.',
    costumeNotes: 'Structured blazer, dark colors. Wedding ring on a chain necklace.',
    createdAt: '2025-02-15T10:00:00Z',
  },
  {
    id: 'cast-3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    actorName: 'Marcus Bell', characterName: 'Ray',
    characterDescription: 'Marcus\'s oldest friend. Charismatic, hides guilt behind humor. Early 40s.',
    status: 'confirmed',
    scenes: [8, 18],
    shootDays: ['2025-03-16', '2025-03-24'],
    availability: 'Limited — 2 days only.',
    performanceNotes: 'Natural comedian — needs to be reined in for dramatic beats.',
    costumeNotes: 'Expensive but tacky — designer jeans, flashy watch.',
    createdAt: '2025-02-20T10:00:00Z',
  },
];

// === LOOKBOOK ===

export const SAMPLE_LOOKBOOK: LookbookItem[] = [
  {
    id: 'lb-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'tone',
    title: 'Quiet Devastation',
    description: 'The film lives in silences. Every conversation has more unsaid than said. Think Antonioni\'s sense of alienation but grounded in American Southwest.',
    sortOrder: 0, createdAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lb-2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'visual-style',
    title: 'Natural Light, Long Takes',
    description: 'Shoot with available light whenever possible. Desert sequences feel like Malick — golden, expansive. Interior scenes cramped, underlit.',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600',
    sortOrder: 1, createdAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lb-3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'color-palette',
    title: 'Desert Warm / Interior Cool',
    description: 'Exteriors: amber, burnt sienna, dusty gold. Interiors: steel blue, muted green, gray.',
    colorHex: '#D4A76A',
    sortOrder: 2, createdAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lb-4', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'reference-film',
    title: 'Paris, Texas (1984)',
    description: 'The spiritual ancestor of this film. A man walking through the desert, running from himself.',
    referenceFilm: 'Paris, Texas',
    sortOrder: 3, createdAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lb-5', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'shot-style',
    title: 'Locked-Off Frames',
    description: 'Minimal camera movement. When the camera moves, it means something. Static frames that let the audience study the composition.',
    sortOrder: 4, createdAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lb-6', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', section: 'sound-music',
    title: 'Ambient Dread, Sparse Score',
    description: 'Wind, highway hum, distant thunder. Score enters sparingly — solo guitar, single cello line. Never sentimental.',
    sortOrder: 5, createdAt: '2025-02-10T10:00:00Z',
  },
];

export const SAMPLE_DIRECTOR_STATEMENT: DirectorStatement[] = [
  {
    id: 'ds-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    text: 'The Last Light is about the moment you realize you can\'t outrun yourself. Marcus drives because stopping means thinking, and thinking means remembering.\n\nI want the audience to sit with discomfort. To feel the silence between two people who once loved each other. The desert is not a metaphor — it\'s a mirror.\n\nWe\'re making a film that trusts the audience. No exposition dumps, no flashback montages. Just faces, landscapes, and the terrible gravity of choices we can\'t undo.',
    updatedAt: '2025-02-12T10:00:00Z',
  },
];

// === SELECTS ===

export const SAMPLE_SELECTS: SceneSelect[] = [
  {
    id: 'sel-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', takeNumber: 4,
    rating: 5, isCircled: true, isAlt: false,
    editorNote: 'USE THIS — the long pause before he exits the car is exactly what we want.',
    performanceNote: 'Daniel found the moment naturally. The exhaustion reads perfectly.',
    technicalNote: 'Slight focus drift at 00:42 but recoverable.',
    timecode: '01:02:14:08',
    createdAt: '2025-03-15T18:00:00Z',
  },
  {
    id: 'sel-2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 1, shotNumber: '1A', takeNumber: 2,
    rating: 3, isCircled: false, isAlt: true,
    editorNote: 'ALT — use if we need a version where he hesitates longer.',
    performanceNote: 'More vulnerable but less controlled.',
    technicalNote: 'Clean technically.',
    timecode: '01:01:48:22',
    createdAt: '2025-03-15T18:05:00Z',
  },
  {
    id: 'sel-3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', sceneNumber: 5, shotNumber: '5A', takeNumber: 6,
    rating: 5, isCircled: true, isAlt: false,
    editorNote: 'CIRCLE SELECT — the phone call. Let it breathe for the full 8 seconds after hanging up. DO NOT trim.',
    performanceNote: 'Best take of the entire shoot. The crack in her voice was unplanned.',
    technicalNote: 'Locked off, no issues.',
    timecode: '02:15:33:04',
    createdAt: '2025-03-17T19:30:00Z',
  },
];

// === COMMUNICATION HUB ===

export const MESSAGE_TEMPLATES: { category: DirectorMessage['category']; label: string; subject: string; body: string; defaultRecipients: string[] }[] = [
  { category: 'moving-on', label: 'Moving On', subject: 'Moving on from Scene {scene}', body: 'We are moving on from Scene {scene}. Next up: Scene {next}. Please reset for the new setup.', defaultRecipients: ['All Departments'] },
  { category: 'pickup', label: 'Pickup Needed', subject: 'Pickup needed — Scene {scene}', body: 'We need a pickup on Scene {scene}, Shot {shot}. Reason: {reason}. Please stand by for setup details.', defaultRecipients: ['Camera', 'Sound', 'Lighting'] },
  { category: 'schedule-change', label: 'Schedule Change', subject: 'Revised schedule — {detail}', body: 'Please note the following schedule change: {detail}. Updated call sheet will follow.', defaultRecipients: ['All Departments'] },
  { category: 'schedule-change', label: 'Revised Call Time', subject: 'Updated call time — {time}', body: 'Tomorrow\'s call time has been revised to {time}. Please adjust accordingly and confirm receipt.', defaultRecipients: ['All Departments'] },
  { category: 'safety', label: 'Safety Alert', subject: 'SAFETY: {detail}', body: 'Safety notice: {detail}. All crew please acknowledge and follow safety protocols.', defaultRecipients: ['All Departments'] },
  { category: 'creative', label: 'Creative Direction', subject: 'Creative note — Scene {scene}', body: '{note}', defaultRecipients: ['Camera', 'Art', 'Talent'] },
  { category: 'general', label: 'Lunch Break', subject: 'Lunch — back at {time}', body: 'We are breaking for lunch. Back on set at {time}. Please be prompt.', defaultRecipients: ['All Departments'] },
  { category: 'general', label: 'That\'s a Wrap', subject: 'WRAP — Day {day}', body: 'That\'s a wrap on Day {day}! Great work everyone. Call sheet for tomorrow will be sent by {time}. Thank you.', defaultRecipients: ['All Departments'] },
];

export const SAMPLE_MESSAGES: DirectorMessage[] = [
  {
    id: 'msg-1', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'moving-on', priority: 'normal',
    subject: 'Moving on from Scene 1',
    body: 'We are moving on from Scene 1. Next up: Scene 5. Please reset for the new setup.',
    recipients: ['All Departments'], sentAt: '2025-03-15T11:30:00Z', sceneNumber: 1,
  },
  {
    id: 'msg-2', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'pickup', priority: 'urgent',
    subject: 'Pickup needed — Scene 5',
    body: 'We need a pickup on Scene 5, Shot 5B. Reason: dolly bump at end of take. Please stand by for setup details.',
    recipients: ['Camera', 'Sound', 'Lighting'], sentAt: '2025-03-17T15:45:00Z', sceneNumber: 5,
  },
  {
    id: 'msg-3', projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', category: 'general', priority: 'normal',
    subject: 'WRAP — Day 1',
    body: 'That\'s a wrap on Day 1! Great work everyone. Call sheet for tomorrow will be sent by 8PM. Thank you.',
    recipients: ['All Departments'], sentAt: '2025-03-15T19:00:00Z',
  },
];
