import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Sun, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog,
  Wind, Droplets, Sunrise, Sunset, AlertCircle, RefreshCw,
  MapPin, Search, Navigation, X, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import * as ExpoLocation from 'expo-location';
import { useProjects } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import PermissionGate from '@/contexts/PermissionGate';

// ─── Types ───

interface DayForecast {
  date: string;
  tempHigh: number;
  tempLow: number;
  conditionCode: number;
  windSpeed: number;
  humidity: number;
  precipChance: number;
  sunrise: string;
  sunset: string;
  goldenHourAM: string;
  goldenHourPM: string;
  uvIndex: number;
}

interface GeoResult {
  lat: number;
  lon: number;
  name: string;
  country?: string;
  admin1?: string;
}

interface ForecastState {
  loading: boolean;
  error: string | null;
  forecast: DayForecast[];
  geocodedName: string | null;
  lat?: number;
  lon?: number;
}

// ─── Weather helpers ───

function getConditionConfig(code: number): { icon: React.ElementType; color: string; label: string } {
  if (code === 0) return { icon: Sun, color: '#FBBF24', label: 'Clear Sky' };
  if (code <= 3) return { icon: Cloud, color: '#94A3B8', label: code === 1 ? 'Mainly Clear' : code === 2 ? 'Partly Cloudy' : 'Overcast' };
  if (code <= 49) return { icon: CloudFog, color: '#9CA3AF', label: 'Fog' };
  if (code <= 59) return { icon: CloudRain, color: '#60A5FA', label: 'Drizzle' };
  if (code <= 69) return { icon: CloudRain, color: '#3B82F6', label: 'Rain' };
  if (code <= 79) return { icon: CloudSnow, color: '#E0E7FF', label: 'Snow' };
  if (code <= 84) return { icon: CloudRain, color: '#2563EB', label: 'Rain Showers' };
  if (code <= 86) return { icon: CloudSnow, color: '#C7D2FE', label: 'Snow Showers' };
  if (code <= 99) return { icon: CloudLightning, color: '#F87171', label: 'Thunderstorm' };
  return { icon: Cloud, color: '#6B7280', label: 'Unknown' };
}

function calcGoldenHour(sunriseISO: string, sunsetISO: string): { am: string; pm: string } {
  try {
    const rise = new Date(sunriseISO);
    const set = new Date(sunsetISO);
    const riseEnd = new Date(rise.getTime() + 30 * 60 * 1000);
    const setStart = new Date(set.getTime() - 30 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { am: `${fmt(rise)}–${fmt(riseEnd)}`, pm: `${fmt(setStart)}–${fmt(set)}` };
  } catch { return { am: 'N/A', pm: 'N/A' }; }
}

// ─── API functions ───

async function geocodeSearch(query: string): Promise<GeoResult[]> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    );
    const data = await res.json();
    if (data.results?.length > 0) {
      return data.results.map((r: any) => ({
        lat: r.latitude,
        lon: r.longitude,
        name: r.name,
        country: r.country,
        admin1: r.admin1,
      }));
    }
    return [];
  } catch { return []; }
}

async function fetchForecast(lat: number, lon: number): Promise<DayForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset&hourly=relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.daily) return [];
  const days: DayForecast[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    const sunriseISO = data.daily.sunrise[i];
    const sunsetISO = data.daily.sunset[i];
    const golden = calcGoldenHour(sunriseISO, sunsetISO);
    const hourlyHumidity = data.hourly?.relative_humidity_2m?.slice(i * 24, (i + 1) * 24) ?? [];
    const avgHumidity = hourlyHumidity.length > 0
      ? Math.round(hourlyHumidity.reduce((s: number, v: number) => s + v, 0) / hourlyHumidity.length) : 0;
    const fmtSun = (iso: string) => {
      try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
      catch { return iso; }
    };
    days.push({
      date: data.daily.time[i],
      tempHigh: Math.round(data.daily.temperature_2m_max[i]),
      tempLow: Math.round(data.daily.temperature_2m_min[i]),
      conditionCode: data.daily.weather_code[i],
      windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
      humidity: avgHumidity,
      precipChance: data.daily.precipitation_probability_max[i] ?? 0,
      sunrise: fmtSun(sunriseISO),
      sunset: fmtSun(sunsetISO),
      goldenHourAM: golden.am,
      goldenHourPM: golden.pm,
      uvIndex: Math.round(data.daily.uv_index_max[i] ?? 0),
    });
  }
  return days;
}

// ─── Known coordinates fallback ───

const KNOWN_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'point reyes lighthouse': { lat: 37.9963, lon: -123.0247 },
  'point reyes': { lat: 37.9963, lon: -123.0247 },
  'point reyes national seashore': { lat: 37.9963, lon: -123.0247 },
  'stage b - lighthouse interior': { lat: 37.9735, lon: -122.5311 },
  'stage b': { lat: 37.9735, lon: -122.5311 },
  'san rafael': { lat: 37.9735, lon: -122.5311 },
};

function lookupKnownCoordinates(name: string, address: string): { lat: number; lon: number } | null {
  const nameKey = name.toLowerCase().trim();
  if (KNOWN_COORDINATES[nameKey]) return KNOWN_COORDINATES[nameKey];
  const addrKey = address.toLowerCase().trim();
  if (KNOWN_COORDINATES[addrKey]) return KNOWN_COORDINATES[addrKey];
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (nameKey.includes(key) || addrKey.includes(key)) return coords;
  }
  return null;
}

// ─── Components ───

function ForecastCard({ day, isExpanded, onToggle }: { day: DayForecast; isExpanded: boolean; onToggle: () => void }) {
  const config = getConditionConfig(day.conditionCode);
  const Icon = config.icon;
  const dateObj = new Date(day.date + 'T12:00:00');
  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isToday = new Date().toISOString().split('T')[0] === day.date;

  return (
    <TouchableOpacity
      style={[styles.card, isToday && styles.cardToday]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {/* Always visible header */}
      <View style={styles.cardHeader}>
        <Text style={styles.dayText}>{isToday ? '📍 Today' : dayStr}</Text>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.condBadge, { backgroundColor: config.color + '20' }]}>
            <Icon color={config.color} size={14} />
            <Text style={[styles.condText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.tempCompact}>{day.tempHigh}°/{day.tempLow}°</Text>
          {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
        </View>
      </View>

      {/* Expanded details */}
      {isExpanded && (
        <View style={styles.cardBody}>
          <View style={styles.tempRow}>
            <Text style={styles.tempHigh}>{day.tempHigh}°F</Text>
            <Text style={styles.tempLow}>{day.tempLow}°F</Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}><Wind color={Colors.text.tertiary} size={14} /><Text style={styles.detailText}>{day.windSpeed} mph</Text></View>
            <View style={styles.detailItem}><Droplets color={Colors.text.tertiary} size={14} /><Text style={styles.detailText}>{day.humidity}%</Text></View>
            <View style={styles.detailItem}><CloudRain color={Colors.text.tertiary} size={14} /><Text style={styles.detailText}>{day.precipChance}% rain</Text></View>
            <View style={styles.detailItem}><Sun color={Colors.text.tertiary} size={14} /><Text style={styles.detailText}>UV {day.uvIndex}</Text></View>
          </View>

          <View style={styles.sunRow}>
            <View style={styles.sunItem}><Sunrise color={Colors.accent.gold} size={14} /><Text style={styles.sunText}>{day.sunrise}</Text></View>
            <View style={styles.sunItem}><Sunset color={Colors.accent.goldDim} size={14} /><Text style={styles.sunText}>{day.sunset}</Text></View>
          </View>

          <View style={styles.goldenRow}>
            <Text style={styles.goldenLabel}>🌅 Golden Hour</Text>
            <Text style={styles.goldenText}>AM: {day.goldenHourAM}</Text>
            <Text style={styles.goldenText}>PM: {day.goldenHourPM}</Text>
          </View>

          {day.precipChance >= 40 && (
            <View style={styles.alertRow}>
              <AlertCircle color={Colors.status.warning} size={14} />
              <Text style={styles.alertText}>{day.precipChance}% precipitation — consider weather contingency</Text>
            </View>
          )}
          {day.windSpeed >= 20 && (
            <View style={styles.alertRow}>
              <Wind color={Colors.status.warning} size={14} />
              <Text style={styles.alertText}>High wind ({day.windSpeed} mph) — may affect sound & rigging</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function WeatherSection({ title, subtitle, forecast, loading, error, onRefresh, onDismiss, expandedDate, onToggleDate }: {
  title: string;
  subtitle?: string | null;
  forecast: DayForecast[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDismiss?: () => void;
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin color={Colors.text.tertiary} size={10} />
              <Text style={styles.sectionSub}>{subtitle}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <RefreshCw color={Colors.accent.gold} size={16} />
          </TouchableOpacity>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.refreshBtn}>
              <X color={Colors.text.tertiary} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.accent.gold} />
          <Text style={styles.loadingText}>Fetching forecast...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle color={Colors.status.error} size={16} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {forecast.map(day => (
        <ForecastCard
          key={day.date}
          day={day}
          isExpanded={expandedDate === day.date}
          onToggle={() => onToggleDate(day.date)}
        />
      ))}
    </View>
  );
}

// ─── Location forecast hook ───

function useLocationForecast(locationName: string, address: string, latitude?: number, longitude?: number) {
  const [state, setState] = useState<ForecastState>({ loading: true, error: null, forecast: [], geocodedName: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      let lat = latitude;
      let lon = longitude;
      let resolvedName: string | null = null;

      if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
        resolvedName = locationName;
      } else {
        const known = lookupKnownCoordinates(locationName, address);
        if (known) {
          lat = known.lat; lon = known.lon; resolvedName = locationName;
        } else {
          const results = await geocodeSearch(address || locationName);
          if (results.length === 0) {
            setState({ loading: false, error: 'Could not find coordinates for this location', forecast: [], geocodedName: null });
            return;
          }
          lat = results[0].lat; lon = results[0].lon; resolvedName = results[0].name;
        }
      }

      const forecast = await fetchForecast(lat!, lon!);
      setState({ loading: false, error: null, forecast, geocodedName: resolvedName, lat, lon });
    } catch {
      setState({ loading: false, error: 'Failed to fetch weather data', forecast: [], geocodedName: null });
    }
  }, [address, locationName, latitude, longitude]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

// ─── Search result section ───

interface SearchSection {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
}

function SearchWeatherSection({ section, onDismiss, expandedDate, onToggleDate }: {
  section: SearchSection;
  onDismiss: () => void;
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
}) {
  const [state, setState] = useState<ForecastState>({ loading: true, error: null, forecast: [], geocodedName: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const forecast = await fetchForecast(section.lat, section.lon);
      setState({ loading: false, error: null, forecast, geocodedName: section.name });
    } catch {
      setState({ loading: false, error: 'Failed to fetch weather data', forecast: [], geocodedName: null });
    }
  }, [section.lat, section.lon, section.name]);

  useEffect(() => { load(); }, [load]);

  return (
    <WeatherSection
      title={section.name}
      subtitle={section.subtitle}
      forecast={state.forecast}
      loading={state.loading}
      error={state.error}
      onRefresh={load}
      onDismiss={onDismiss}
      expandedDate={expandedDate}
      onToggleDate={onToggleDate}
    />
  );
}

// ─── Project location section ───

function ProjectLocationSection({ locationName, address, latitude, longitude, expandedDate, onToggleDate }: {
  locationName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
}) {
  const { forecast, loading, error, geocodedName, reload } = useLocationForecast(locationName, address, latitude, longitude);

  return (
    <WeatherSection
      title={locationName}
      subtitle={geocodedName !== locationName ? geocodedName : address}
      forecast={forecast}
      loading={loading}
      error={error}
      onRefresh={reload}
      expandedDate={expandedDate}
      onToggleDate={onToggleDate}
    />
  );
}

// ─── Main screen ───

export default function LocationWeatherScreen() {
  const { activeProject, locations } = useProjects();
  const { isTablet, contentPadding } = useLayout();
  const projectLocations = locations.filter(l => l.projectId === activeProject?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSections, setSearchSections] = useState<SearchSection[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(
    new Date().toISOString().split('T')[0] // Today expanded by default
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const handleToggleDate = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    const results = await geocodeSearch(searchQuery.trim());
    setSearchResults(results);
    setSearching(false);

    // If exactly 1 result, add it directly
    if (results.length === 1) {
      addSearchSection(results[0]);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const addSearchSection = (geo: GeoResult) => {
    const subtitle = [geo.admin1, geo.country].filter(Boolean).join(', ');
    const exists = searchSections.find(s => s.lat === geo.lat && s.lon === geo.lon);
    if (exists) return;
    setSearchSections(prev => [{
      id: `search-${Date.now()}`,
      name: geo.name,
      subtitle,
      lat: geo.lat,
      lon: geo.lon,
    }, ...prev]);
    setSearchResults([]);
    setSearchQuery('');
  };

  const removeSearchSection = (id: string) => {
    setSearchSections(prev => prev.filter(s => s.id !== id));
  };

  // GPS
  const handleCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to get weather for your current position.');
        setGpsLoading(false);
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const [reverse] = await ExpoLocation.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const name = reverse?.city || reverse?.district || reverse?.name || 'Current Location';
      const subtitle = [reverse?.region, reverse?.country].filter(Boolean).join(', ');

      // Don't add duplicate
      const exists = searchSections.find(s =>
        Math.abs(s.lat - loc.coords.latitude) < 0.01 && Math.abs(s.lon - loc.coords.longitude) < 0.01
      );
      if (!exists) {
        setSearchSections(prev => [{
          id: `gps-${Date.now()}`,
          name: `📍 ${name}`,
          subtitle,
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
        }, ...prev]);
      }
    } catch (e: any) {
      Alert.alert('Location Error', e.message || 'Could not get current location');
    }
    setGpsLoading(false);
  };

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Location Weather' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="weather">
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, {
        paddingHorizontal: contentPadding,
        maxWidth: isTablet ? 800 : undefined,
        alignSelf: isTablet ? 'center' as const : undefined,
        width: isTablet ? '100%' : undefined,
      }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Location Weather' }} />

      <View style={styles.poweredBy}>
        <Text style={styles.poweredByText}>Live 7-day forecast • Powered by Open-Meteo.com</Text>
      </View>

      {/* ─── Search bar ─── */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search color={Colors.text.tertiary} size={16} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search city or address..."
              placeholderTextColor={Colors.text.tertiary}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <X color={Colors.text.tertiary} size={14} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>Go</Text>
          </TouchableOpacity>
        </View>

        {/* GPS button */}
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={handleCurrentLocation}
          activeOpacity={0.7}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={Colors.accent.gold} />
          ) : (
            <Navigation color={Colors.accent.gold} size={16} />
          )}
          <Text style={styles.gpsBtnText}>
            {gpsLoading ? 'Getting location...' : 'Use Current Location'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Search loading ─── */}
      {searching && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.accent.gold} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* ─── Search results dropdown ─── */}
      {searchResults.length > 1 && (
        <View style={styles.resultsDropdown}>
          <Text style={styles.resultsHint}>Select a location:</Text>
          {searchResults.map((geo, i) => (
            <TouchableOpacity
              key={`${geo.lat}-${geo.lon}-${i}`}
              style={styles.resultItem}
              onPress={() => addSearchSection(geo)}
              activeOpacity={0.7}
            >
              <MapPin color={Colors.accent.gold} size={14} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{geo.name}</Text>
                <Text style={styles.resultSub}>
                  {[geo.admin1, geo.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searchResults.length === 0 && !searching && searchQuery.length > 0 && (
        <View style={styles.errorBox}>
          <AlertCircle color={Colors.text.tertiary} size={14} />
          <Text style={styles.errorText}>No locations found. Try a different search.</Text>
        </View>
      )}

      {/* ─── Search-added weather sections ─── */}
      {searchSections.map(section => (
        <SearchWeatherSection
          key={section.id}
          section={section}
          onDismiss={() => removeSearchSection(section.id)}
          expandedDate={expandedDate}
          onToggleDate={handleToggleDate}
        />
      ))}

      {/* ─── Divider if both search sections and project locations ─── */}
      {searchSections.length > 0 && projectLocations.length > 0 && (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Project Locations</Text>
          <View style={styles.dividerLine} />
        </View>
      )}

      {/* ─── Project locations ─── */}
      {projectLocations.map(loc => (
        <ProjectLocationSection
          key={loc.id}
          locationName={loc.name}
          address={loc.address}
          latitude={(loc as any).latitude}
          longitude={(loc as any).longitude}
          expandedDate={expandedDate}
          onToggleDate={handleToggleDate}
        />
      ))}

      {/* ─── Empty state ─── */}
      {projectLocations.length === 0 && searchSections.length === 0 && (
        <View style={styles.emptyInner}>
          <Sun color={Colors.text.tertiary} size={48} />
          <Text style={styles.emptyTitle}>Search for weather</Text>
          <Text style={styles.emptySub}>
            Search for any city above, use your current location,{'\n'}or add locations in the Locations tool
          </Text>
        </View>
      )}
    </ScrollView>
  </PermissionGate>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  poweredBy: { alignItems: 'center', paddingVertical: 6, marginBottom: 8 },
  poweredByText: { fontSize: 11, color: Colors.text.tertiary },

  // Search
  searchSection: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, paddingHorizontal: 12, gap: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text.primary, paddingVertical: 11 },
  searchBtn: { backgroundColor: Colors.accent.gold, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.bg.card, borderRadius: 10, paddingVertical: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  gpsBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent.gold },

  // Results dropdown
  resultsDropdown: { backgroundColor: Colors.bg.card, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border.subtle, marginBottom: 12, overflow: 'hidden' },
  resultsHint: { fontSize: 11, color: Colors.text.tertiary, padding: 10, paddingBottom: 4 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  resultName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary },
  resultSub: { fontSize: 11, color: Colors.text.tertiary, marginTop: 1 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: Colors.border.subtle },
  dividerText: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent.gold, letterSpacing: 0.3 },
  sectionSub: { fontSize: 11, color: Colors.text.tertiary },
  refreshBtn: { padding: 8 },

  // Forecast card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardToday: { borderColor: Colors.accent.gold + '60', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.primary },
  condBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  condText: { fontSize: 11, fontWeight: '600' as const },
  tempCompact: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary },

  // Card body (expanded)
  cardBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  tempRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'baseline' },
  tempHigh: { fontSize: 32, fontWeight: '800' as const, color: Colors.text.primary },
  tempLow: { fontSize: 20, color: Colors.text.tertiary },
  detailGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: Colors.text.secondary },
  sunRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  sunItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sunText: { fontSize: 12, color: Colors.text.secondary },
  goldenRow: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 8 },
  goldenLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.accent.gold, marginBottom: 4 },
  goldenText: { fontSize: 12, color: Colors.accent.goldLight, marginBottom: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.status.warning + '12', borderRadius: 6, padding: 8, marginTop: 4 },
  alertText: { fontSize: 11, color: Colors.status.warning, flex: 1 },

  // Loading / error
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.text.tertiary },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.status.error + '12', borderRadius: 8, padding: 12, marginBottom: 10 },
  errorText: { fontSize: 13, color: Colors.status.error, flex: 1 },

  // Empty
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center', lineHeight: 20 },
});
