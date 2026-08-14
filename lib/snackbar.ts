export type SnackbarState = { message: string; actionLabel?: string; onAction?: () => void } | null;
type Listener = (state: SnackbarState) => void;

const listeners = new Set<Listener>();
let current: SnackbarState = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  listeners.forEach((listener) => listener(current));
}

/** Shows a snackbar with an optional undo-style action button. Auto-dismisses after durationMs. */
export function showSnackbar(message: string, actionLabel?: string, onAction?: () => void, durationMs = 6000) {
  current = { message, actionLabel, onAction };
  notify();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { current = null; notify(); }, durationMs);
}

export function dismissSnackbar() {
  current = null;
  if (timer) clearTimeout(timer);
  notify();
}

export function subscribeSnackbar(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
