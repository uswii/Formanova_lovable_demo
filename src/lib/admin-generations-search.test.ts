import { describe, expect, it } from 'vitest';

import { matchesAdminGenerationSearch } from './admin-generations-search';

const item = {
  workflow_id: 'wf-123',
  workflow_name: 'jewelry_photoshoots_generator',
  user_email: 'admin-user@example.com',
};

describe('matchesAdminGenerationSearch', () => {
  it('matches workflow name', () => {
    expect(matchesAdminGenerationSearch(item, 'photoshoots')).toBe(true);
  });

  it('matches workflow id', () => {
    expect(matchesAdminGenerationSearch(item, 'wf-123')).toBe(true);
  });

  it('matches user email case-insensitively', () => {
    expect(matchesAdminGenerationSearch(item, 'ADMIN-USER@EXAMPLE.COM')).toBe(true);
  });

  it('ignores surrounding whitespace in the search term', () => {
    expect(matchesAdminGenerationSearch(item, '  example.com  ')).toBe(true);
  });

  it('returns false when no searchable field matches', () => {
    expect(matchesAdminGenerationSearch(item, 'cad-generator')).toBe(false);
  });
});
