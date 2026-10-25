/** Create a UUID accepted by the Supabase commitments.id UUID column on web and React Native. */
export function createUuid(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  // React Native runtimes may not expose crypto.randomUUID. Keep the fallback
  // in canonical UUID v4 format instead of using timestamp-based non-UUID IDs.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
