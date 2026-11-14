export type ActivityMarkers = {
  people: 'solo' | 'together' | null;
  place: 'home' | 'anywhere' | null;
  online: boolean;
  travel: boolean;
};

export const EMPTY_ACTIVITY_MARKERS: ActivityMarkers = {
  people: null,
  place: null,
  online: false,
  travel: false,
};

const PREFIXES = ['👤', '👥', '🏠', '🌍', '💻', '🚗'];

export function parseActivityTitle(value: string): { title: string; markers: ActivityMarkers } {
  const markers: ActivityMarkers = { ...EMPTY_ACTIVITY_MARKERS };
  let title = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const marker of PREFIXES) {
      if (!title.startsWith(marker)) continue;
      title = title.slice(marker.length).trimStart();
      changed = true;
      if (marker === '👤') markers.people = 'solo';
      if (marker === '👥') markers.people = 'together';
      if (marker === '🏠') markers.place = 'home';
      if (marker === '🌍') markers.place = 'anywhere';
      if (marker === '💻') markers.online = true;
      if (marker === '🚗') markers.travel = true;
      break;
    }
  }
  return { title, markers };
}

export function formatActivityTitle(title: string, markers: ActivityMarkers): string {
  const parts: string[] = [];
  if (markers.people === 'solo') parts.push('👤');
  if (markers.people === 'together') parts.push('👥');
  if (markers.place === 'home') parts.push('🏠');
  if (markers.place === 'anywhere') parts.push('🌍');
  if (markers.online) parts.push('💻');
  if (markers.travel) parts.push('🚗');
  const cleanTitle = parseActivityTitle(title).title;
  return [...parts, cleanTitle].filter(Boolean).join(' ');
}
