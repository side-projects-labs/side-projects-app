import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseCatalog, type ProjectEntry } from './catalog';

/** EXPO_PUBLIC_ 값은 앱에 포함되는 공개 정보다. 비밀 값을 넣지 않는다. */
export const CATALOG_URL =
  process.env.EXPO_PUBLIC_CATALOG_URL ??
  'https://raw.githubusercontent.com/side-projects-labs/side-projects-app/master/catalog/projects.json';

const CACHE_KEY = 'catalog.v1';
const TIMEOUT_MS = 5000;

export async function fetchRemoteCatalog(): Promise<ProjectEntry[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const projects = parseCatalog(await res.json());
    if (projects) {
      // 검증을 통과한 값만 캐시한다.
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, projects })).catch(
        () => undefined,
      );
    }
    return projects;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readCachedCatalog(): Promise<ProjectEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? parseCatalog(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
