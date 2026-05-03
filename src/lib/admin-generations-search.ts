import type { AdminGenerationListItem } from '@/lib/admin-generations-api';

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesAdminGenerationSearch(
  item: Pick<AdminGenerationListItem, 'workflow_id' | 'workflow_name' | 'user_email'>,
  rawSearch: string,
): boolean {
  const search = normalizeSearchTerm(rawSearch);
  if (!search) return true;

  return [item.workflow_name, item.workflow_id, item.user_email]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(search));
}
