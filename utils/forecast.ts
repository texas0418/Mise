/**
 * utils/forecast.ts
 *
 * The weather a shoot day actually turns on: what it will do, and when the
 * light arrives and goes. Open-Meteo needs no key and no account.
 *
 * The pure parts sit above the fetch so the formatting can be exercised under
 * `node --experimental-strip-types` without a network.
 *
 * Note: app/location-weather.tsx still carries its own copy of this call. That
 * screen is the seven-day drawer and this is the one-day summary; converging
 * them is tracked separately rather than folded into the Today view.
 */

export interface DayWeather {
  /** YYYY-MM-DD. */
  date: string;
  tempHigh: number;
  tempLow: number;
  conditionCode: number;
  conditionLabel: string;
  precipChance: number;
  windSpeed: number;
  sunrise: string;
  sunset: string;
  goldenHourAM: string;
  goldenHourPM: string;
}

/** WMO weather codes, in the words a first AD would use on a call sheet. */
export function describeCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Fog';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorms';
  return 'Unknown';
}

/** True when the day is wet enough to want a cover set. */
export function needsCoverSet(code: number, precipChance: number): boolean {
  return precipChance >= 50 || (code >= 50 && code <= 99);
}

function formatSunTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

/**
 * The half hour after sunrise and the half hour before sunset — the window
 * everyone is actually asking about when they ask about sunset.
 */
export function goldenHours(sunriseISO: string, sunsetISO: string): { am: string; pm: string } {
  try {
    const rise = new Date(sunriseISO);
    const set = new Date(sunsetISO);
    if (Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime())) return { am: '', pm: '' };
    const riseEnd = new Date(rise.getTime() + 30 * 60 * 1000);
    const setStart = new Date(set.getTime() - 30 * 60 * 1000);
    return {
      am: `${formatSunTime(rise.toISOString())}–${formatSunTime(riseEnd.toISOString())}`,
      pm: `${formatSunTime(setStart.toISOString())}–${formatSunTime(set.toISOString())}`,
    };
  } catch {
    return { am: '', pm: '' };
  }
}

/** First entry of a daily series as a number; the fallback covers a field the API omitted. */
function firstNumber(values: unknown, fallback: number): number {
  const value = Array.isArray(values) ? values[0] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** First entry of a daily series as a string. */
function firstString(values: unknown): string {
  const value = Array.isArray(values) ? values[0] : undefined;
  return typeof value === 'string' ? value : '';
}

/** Shape the one-day slice of an Open-Meteo daily response. */
function toDayWeather(daily: Record<string, unknown>): DayWeather {
  const code = firstNumber(daily.weather_code, -1);
  const sunriseISO = firstString(daily.sunrise);
  const sunsetISO = firstString(daily.sunset);
  const golden = goldenHours(sunriseISO, sunsetISO);

  return {
    date: firstString(daily.time),
    tempHigh: Math.round(firstNumber(daily.temperature_2m_max, 0)),
    tempLow: Math.round(firstNumber(daily.temperature_2m_min, 0)),
    conditionCode: code,
    conditionLabel: describeCondition(code),
    precipChance: Math.round(firstNumber(daily.precipitation_probability_max, 0)),
    windSpeed: Math.round(firstNumber(daily.wind_speed_10m_max, 0)),
    sunrise: formatSunTime(sunriseISO),
    sunset: formatSunTime(sunsetISO),
    goldenHourAM: golden.am,
    goldenHourPM: golden.pm,
  };
}

/**
 * One day's forecast for a set of coordinates.
 *
 * Returns null rather than throwing: the Today view should lose its weather
 * strip on a bad connection, not its call time.
 */
export async function fetchDayWeather(
  latitude: number,
  longitude: number,
  dateKey: string,
): Promise<DayWeather | null> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${latitude}&longitude=${longitude}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset'
    + `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&start_date=${dateKey}&end_date=${dateKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !firstString(daily.time)) return null;
    return toDayWeather(daily);
  } catch {
    return null;
  }
}
