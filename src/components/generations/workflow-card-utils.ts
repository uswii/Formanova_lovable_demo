export const DISPLAY_NAME_MAX_CHARS = 50;

export function truncateDisplayName(name: string): string {
  return name.length > DISPLAY_NAME_MAX_CHARS
    ? `${name.slice(0, DISPLAY_NAME_MAX_CHARS)}...`
    : name;
}

// ── CAD rename persistence ──

const CAD_RENAMES_KEY = 'formanova_cad_renames';

export function loadStoredRenames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CAD_RENAMES_KEY) ?? '{}'); } catch { return {}; }
}

export function saveStoredRename(workflowId: string, name: string) {
  try {
    const map = loadStoredRenames();
    map[workflowId] = name;
    localStorage.setItem(CAD_RENAMES_KEY, JSON.stringify(map));
  } catch { /* quota — ignore */ }
}

// ── Photo rename persistence ──

const PHOTO_RENAMES_KEY = 'formanova_photo_renames';

export function loadPhotoRenames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PHOTO_RENAMES_KEY) ?? '{}'); } catch { return {}; }
}

export function savePhotoRename(id: string, name: string) {
  try {
    const map = loadPhotoRenames();
    map[id] = name;
    localStorage.setItem(PHOTO_RENAMES_KEY, JSON.stringify(map));
  } catch { /* quota */ }
}

// ── Date formatting ──

const localDateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const localDateOnlyFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

function normalizeTs(ts: string): string {
  const t = ts.trim();
  if (t && !/[Zz]$/.test(t) && !/[+-]\d{2}:\d{2}$/.test(t)) return t + 'Z';
  return t;
}

export function formatLocal(ts: string): string {
  return localDateFmt.format(new Date(normalizeTs(ts)));
}

export function formatLocalDateOnly(ts: string): string {
  return localDateOnlyFmt.format(new Date(normalizeTs(ts)));
}
