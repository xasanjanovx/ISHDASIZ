'use client';
import { useSyncExternalStore } from 'react';
import { createBrowserPreferenceStore } from '@/lib/browser-preference-store';
export interface SeekerPreferences {
  districtId?: string;
  categoryIds?: string[];
  salaryMin?: number;
  latitude?: number;
  longitude?: number;
  geoPermission?: 'granted' | 'denied' | 'pending';
  completedAt?: string;
}
function normalize(value: unknown): SeekerPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>, result: SeekerPreferences = {};
  if (typeof raw.districtId === 'string' && raw.districtId.trim() && raw.districtId.length <= 100) result.districtId = raw.districtId;
  if (Array.isArray(raw.categoryIds)) result.categoryIds = Array.from(new Set(raw.categoryIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()) && item.length <= 100))).slice(0, 50);
  if (typeof raw.salaryMin === 'number' && Number.isSafeInteger(raw.salaryMin) && raw.salaryMin >= 0 && raw.salaryMin <= 2147483647) result.salaryMin = raw.salaryMin;
  if (typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) && Math.abs(raw.latitude) <= 90 && typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) && Math.abs(raw.longitude) <= 180) { result.latitude = raw.latitude; result.longitude = raw.longitude; }
  if (raw.geoPermission === 'pending' || raw.geoPermission === 'denied' || raw.geoPermission === 'granted' && result.latitude !== undefined) result.geoPermission = raw.geoPermission;
  if (typeof raw.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw.completedAt) && raw.completedAt.length <= 64 && Number.isFinite(Date.parse(raw.completedAt))) result.completedAt = raw.completedAt;
  return result;
}
const preferences = createBrowserPreferenceStore<SeekerPreferences>('ishdasiz_seeker_preferences', {}, normalize);
export function useSeekerPreferences() {
  const snapshot = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, preferences.getServerSnapshot);
  return { preferences: snapshot.value, isCompleted: Boolean(snapshot.value.completedAt), isLoading: !snapshot.ready,
    updatePreferences: (updates: Partial<SeekerPreferences>) => preferences.update(current => ({ ...current, ...updates })), clearPreferences: preferences.clear };
}
