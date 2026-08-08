// ---------------------------------------------------------------------------
// constants/filmData.ts — Reference data for the production tools
//
// Fixed industry reference values (lens tables, department lists, budget
// categories) that populate pickers and calculators. This is real app data,
// not fixtures — it previously lived in mocks/data.ts alongside a set of
// fictional sample records, which is how those records ended up seeded into
// real user storage (#35). The sample records are gone; this is what remains.
// ---------------------------------------------------------------------------

import { DirectorMessage } from '@/types';

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
