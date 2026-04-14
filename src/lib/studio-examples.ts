/**
 * studio-examples
 *
 * Static example image assets and lookup maps used by the Upload Guide
 * inside UnifiedStudio.
 *
 * WHY THIS EXISTS
 * ---------------
 * UnifiedStudio.tsx imported 30 image assets and defined three constant maps
 * (CATEGORY_EXAMPLES, ACCEPTABLE_EXAMPLES, LABEL_NAMES) at the top of the file.
 * These have nothing to do with generation logic or UI state -- they are pure
 * data. Moving them here keeps UnifiedStudio focused on orchestration and
 * reduces its import block by ~35 lines.
 *
 * EXPORTS
 * -------
 * CATEGORY_EXAMPLES  -- per-category allowed/notAllowed example image arrays
 * ACCEPTABLE_EXAMPLES -- per-category (singular + plural) single acceptable image
 * LABEL_NAMES        -- AI validation label -> human-readable string
 */

import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1 from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1 from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2 from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3 from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1 from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2 from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3 from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1 from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.png';

export const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace:  { allowed: [necklaceAllowed1,  necklaceAllowed2,  necklaceAllowed3],  notAllowed: [necklaceNotAllowed1,  necklaceNotAllowed2,  necklaceNotAllowed3]  },
  earrings:  { allowed: [earringAllowed1,   earringAllowed2,   earringAllowed3],   notAllowed: [earringNotAllowed1,   earringNotAllowed2,   earringNotAllowed3]   },
  bracelets: { allowed: [braceletAllowed1,  braceletAllowed2,  braceletAllowed3],  notAllowed: [braceletNotAllowed1,  braceletNotAllowed2,  braceletNotAllowed3]  },
  rings:     { allowed: [ringAllowed1,      ringAllowed2,      ringAllowed3],      notAllowed: [ringNotAllowed1,      ringNotAllowed2,      ringNotAllowed3]      },
  watches:   { allowed: [watchAllowed1,     watchAllowed2,     watchAllowed3],     notAllowed: [watchNotAllowed1,     watchNotAllowed2,     watchNotAllowed3]     },
};

export const ACCEPTABLE_EXAMPLES: Record<string, string> = {
  necklace: necklaceAllowed3,  necklaces: necklaceAllowed3,
  earring:  earringAllowed3,   earrings:  earringAllowed3,
  bracelet: braceletAllowed3,  bracelets: braceletAllowed3,
  ring:     ringAllowed3,      rings:     ringAllowed3,
  watch:    watchAllowed3,     watches:   watchAllowed3,
};

export const LABEL_NAMES: Record<string, string> = {
  flatlay:         'a flat lay',
  product_surface: 'a product shot',
  '3d_render':     'a 3D render',
  packshot:        'a packshot',
  floating:        'a floating product',
};
