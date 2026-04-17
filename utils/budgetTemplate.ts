/**
 * utils/budgetTemplate.ts
 *
 * Industry-standard film budget template.
 * Generates bare-bones line items (category + description, zero amounts)
 * that a director can fill in with their own numbers.
 */

import { BudgetItem, BudgetCategory } from '@/types';

interface TemplateLine {
  category: BudgetCategory;
  description: string;
}

/**
 * Industry-standard film budget line items, ordered:
 * Above the Line → Below the Line → Production → Post → Other
 */
const TEMPLATE_LINES: TemplateLine[] = [
  // ── Above the Line: Talent ──
  { category: 'talent', description: 'Lead Actor 1' },
  { category: 'talent', description: 'Lead Actor 2' },
  { category: 'talent', description: 'Supporting Cast' },
  { category: 'talent', description: 'Background / Extras' },
  { category: 'talent', description: 'Casting Director' },
  { category: 'talent', description: 'Stunt Coordinator' },

  // ── Crew ──
  { category: 'crew', description: 'Director' },
  { category: 'crew', description: 'Producer' },
  { category: 'crew', description: 'Line Producer / UPM' },
  { category: 'crew', description: '1st Assistant Director' },
  { category: 'crew', description: '2nd Assistant Director' },
  { category: 'crew', description: 'Director of Photography' },
  { category: 'crew', description: '1st AC / Focus Puller' },
  { category: 'crew', description: '2nd AC / Clapper Loader' },
  { category: 'crew', description: 'Gaffer' },
  { category: 'crew', description: 'Key Grip' },
  { category: 'crew', description: 'Sound Mixer' },
  { category: 'crew', description: 'Boom Operator' },
  { category: 'crew', description: 'Script Supervisor' },
  { category: 'crew', description: 'Production Assistant(s)' },

  // ── Equipment ──
  { category: 'equipment', description: 'Camera Package Rental' },
  { category: 'equipment', description: 'Lens Kit Rental' },
  { category: 'equipment', description: 'Lighting Package' },
  { category: 'equipment', description: 'Grip & Rigging' },
  { category: 'equipment', description: 'Sound Equipment' },
  { category: 'equipment', description: 'Dollies / Sliders / Stabilizers' },
  { category: 'equipment', description: 'Media / Hard Drives / Cards' },
  { category: 'equipment', description: 'Monitors & Video Village' },
  { category: 'equipment', description: 'Walkie-Talkies / Comms' },

  // ── Locations ──
  { category: 'locations', description: 'Location Fee — Primary' },
  { category: 'locations', description: 'Location Fee — Secondary' },
  { category: 'locations', description: 'Permits & Fees' },
  { category: 'locations', description: 'Parking / Base Camp' },
  { category: 'locations', description: 'Studio / Stage Rental' },

  // ── Production Design ──
  { category: 'production-design', description: 'Production Designer' },
  { category: 'production-design', description: 'Art Department Supplies' },
  { category: 'production-design', description: 'Set Construction' },
  { category: 'production-design', description: 'Props' },
  { category: 'production-design', description: 'Wardrobe / Costumes' },
  { category: 'production-design', description: 'Hair & Makeup' },
  { category: 'production-design', description: 'Special Effects (Practical)' },

  // ── Catering ──
  { category: 'catering', description: 'Craft Services' },
  { category: 'catering', description: 'Catered Meals' },
  { category: 'catering', description: 'Water / Beverages' },

  // ── Transport ──
  { category: 'transport', description: 'Equipment Truck / Van Rental' },
  { category: 'transport', description: 'Cast / Crew Transport' },
  { category: 'transport', description: 'Fuel' },
  { category: 'transport', description: 'Mileage Reimbursements' },

  // ── Music ──
  { category: 'music', description: 'Composer / Score' },
  { category: 'music', description: 'Licensed Music / Sync Fees' },
  { category: 'music', description: 'Music Supervisor' },

  // ── Post-Production ──
  { category: 'post-production', description: 'Editor' },
  { category: 'post-production', description: 'Editing Suite / Software' },
  { category: 'post-production', description: 'Color Grading / DI' },
  { category: 'post-production', description: 'Sound Design & Mix' },
  { category: 'post-production', description: 'ADR / Foley' },
  { category: 'post-production', description: 'VFX / Motion Graphics' },
  { category: 'post-production', description: 'DCP / Deliverables' },
  { category: 'post-production', description: 'Closed Captions / Subtitles' },

  // ── Marketing ──
  { category: 'marketing', description: 'Poster / Key Art' },
  { category: 'marketing', description: 'Trailer Edit' },
  { category: 'marketing', description: 'Press Kit / EPK' },
  { category: 'marketing', description: 'Social Media / Advertising' },
  { category: 'marketing', description: 'Website / Domain' },

  // ── Legal ──
  { category: 'legal', description: 'Entertainment Attorney' },
  { category: 'legal', description: 'Contracts / Agreements' },
  { category: 'legal', description: 'LLC / Business Formation' },
  { category: 'legal', description: 'Music Rights Clearance' },

  // ── Insurance ──
  { category: 'insurance', description: 'Production Insurance (E&O)' },
  { category: 'insurance', description: 'General Liability' },
  { category: 'insurance', description: 'Equipment Insurance' },
  { category: 'insurance', description: "Workers' Comp" },

  // ── Contingency ──
  { category: 'contingency', description: 'Contingency (10%)' },
  { category: 'contingency', description: 'Overages / Miscellaneous' },
];

/**
 * Generate budget items from the film template.
 * All amounts are zero — the director fills them in.
 */
export function generateBudgetTemplate(projectId: string): BudgetItem[] {
  const now = Date.now();
  return TEMPLATE_LINES.map((line, i) => ({
    id: `tmpl-${now}-${i}`,
    projectId,
    category: line.category,
    description: line.description,
    estimated: 0,
    actual: 0,
    notes: '',
    vendor: undefined,
    paid: false,
  }));
}

/** How many line items the template contains */
export const TEMPLATE_LINE_COUNT = TEMPLATE_LINES.length;
