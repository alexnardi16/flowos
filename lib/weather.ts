import * as Location from 'expo-location';
import { buildWeatherSummary, type WeatherSummary } from './weatherSummary';
import { logNotificationEvent } from './notificationLog';

const CACHE_TTL_MS = 60 * 60 * 1000; // an hourly forecast doesn't need refetching every sync
let cache: { at: number; summary: WeatherSummary } | null = null;

/**
 * Fetches today's forecast for the device's current location via Open-Meteo
 * (https://open-meteo.com — free, no API key, no account needed). Returns
 * null on any failure (permission denied, offline, API error): weather is a
 * nice-to-have on the daily summary, never something that should block it.
 */
export async function fetchTodayWeather(): Promise<WeatherSummary | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.summary;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const requested = await Location.requestForegroundPermissionsAsync();
      granted = requested.status === 'granted';
    }
    if (!granted) {
      await logNotificationEvent('weather-permission-denied', undefined, 'warn');
      return null;
    }

    const position = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = position.coords;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`open-meteo HTTP ${response.status}`);
    const data = await response.json();

    const summary = buildWeatherSummary({
      weatherCode: data.daily.weathercode[0],
      tempMaxC: data.daily.temperature_2m_max[0],
      tempMinC: data.daily.temperature_2m_min[0],
      precipitationProbability: data.daily.precipitation_probability_max[0] ?? 0,
    });
    cache = { at: Date.now(), summary };
    return summary;
  } catch (error) {
    await logNotificationEvent('weather-fetch-failed', error, 'warn');
    return null;
  }
}
