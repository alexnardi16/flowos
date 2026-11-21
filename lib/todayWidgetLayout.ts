/**
 * Wrap Today-widget titles into explicit lines.
 *
 * Android's automatic TextView wrapping can differ from the character-based
 * line estimate used to size a RemoteViews card. Rendering these exact lines
 * keeps visible title height and calculated card height in sync.
 */
export function wrapTodayWidgetTitle(text: string, maxChars = 28): string[] {
  const clean = text.trim();
  if (!clean) return [''];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}
