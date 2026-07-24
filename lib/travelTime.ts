export type TravelTimeEstimate = {
  destination: string;
  durationMinutes: number;
  distanceKm: number;
  mode: 'driving' | 'transit' | 'walking';
};

/**
 * NOT IMPLEMENTED. Traffic-aware travel time needs a routing API — Google
 * Distance Matrix / Routes API is the standard choice — which requires a
 * billed API key. This environment has neither the key nor network access
 * to maps.googleapis.com to build and test an integration blind, and a
 * wrong integration here is worse than none: it would look like it works
 * and silently give bad estimates.
 *
 * To wire this in for real:
 *  1. Get a Google Cloud API key with the Routes API (or Distance Matrix
 *     API) enabled and billing configured.
 *  2. Store it as an EAS secret / server-side env var — never in the app
 *     bundle, it would be extractable from any built APK/IPA.
 *  3. Route the actual request through a Supabase Edge Function (same
 *     pattern as interpret-commitment) so the key never ships to the
 *     client, passing origin (device location, from lib/weather.ts's
 *     existing expo-location setup) and destination (would need commitment
 *     locations to be geocoded — item.location is free text today, not
 *     coordinates).
 *  4. Replace this stub's body with the real fetch call.
 */
export async function fetchTravelTime(_destination: string): Promise<TravelTimeEstimate | null> {
  return null;
}
