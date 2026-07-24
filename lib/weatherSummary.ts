export type DailyWeatherRaw = {
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbability: number;
};

export type WeatherSummary = {
  label: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationProbability: number;
  text: string;
};

// WMO weather interpretation codes (open-meteo.com/en/docs), the subset
// realistically returned by a daily forecast.
const WMO_LABELS: Record<number, string> = {
  0: 'cielo sereno',
  1: 'prevalentemente sereno',
  2: 'parzialmente nuvoloso',
  3: 'nuvoloso',
  45: 'nebbia',
  48: 'nebbia con brina',
  51: 'pioviggine leggera',
  53: 'pioviggine',
  55: 'pioviggine intensa',
  61: 'pioggia leggera',
  63: 'pioggia',
  65: 'pioggia intensa',
  71: 'neve leggera',
  73: 'neve',
  75: 'neve intensa',
  77: 'granelli di neve',
  80: 'rovesci leggeri',
  81: 'rovesci',
  82: 'rovesci violenti',
  95: 'temporale',
  96: 'temporale con grandine',
  99: 'temporale con grandine forte',
};

function labelFor(code: number): string {
  return WMO_LABELS[code] ?? 'condizioni variabili';
}

/**
 * Pure function: turns a raw daily forecast into the short line shown in
 * the daily summary notification and the Piano suggestions. No I/O — the
 * network fetch lives in lib/weather.ts.
 */
export function buildWeatherSummary(raw: DailyWeatherRaw): WeatherSummary {
  const label = labelFor(raw.weatherCode);
  const min = Math.round(raw.tempMinC);
  const max = Math.round(raw.tempMaxC);
  const rain = Math.round(raw.precipitationProbability);
  const rainNote = rain >= 40 ? `, ${rain}% di probabilità di pioggia` : '';
  return {
    label,
    tempMinC: min,
    tempMaxC: max,
    precipitationProbability: rain,
    text: `${label}, ${min}–${max}°C${rainNote}`,
  };
}
