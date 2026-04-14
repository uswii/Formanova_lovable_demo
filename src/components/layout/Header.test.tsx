import { describe, expect, it } from 'vitest';

import { isNavLinkActivePath } from './Header';

const cadLink = {
  path: '/studio-cad',
  activePaths: ['/studio-cad', '/text-to-cad', '/cad-to-catalog'],
};

describe('isNavLinkActivePath', () => {
  it('marks CAD Studio active on CAD hub and child entry routes', () => {
    expect(isNavLinkActivePath('/studio-cad', cadLink)).toBe(true);
    expect(isNavLinkActivePath('/text-to-cad', cadLink)).toBe(true);
    expect(isNavLinkActivePath('/cad-to-catalog', cadLink)).toBe(true);
  });

  it('keeps non-CAD routes inactive for the CAD nav link', () => {
    expect(isNavLinkActivePath('/studio', cadLink)).toBe(false);
    expect(isNavLinkActivePath('/dashboard', cadLink)).toBe(false);
  });
});
