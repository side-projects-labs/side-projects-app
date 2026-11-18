import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { BUNDLED_PROJECTS, findProject, type ProjectEntry } from './catalog';
import { fetchRemoteCatalog, readCachedCatalog } from './catalog-source';

type CatalogSource = 'bundled' | 'cache' | 'remote';

type CatalogState = {
  projects: readonly ProjectEntry[];
  source: CatalogSource;
  refreshing: boolean;
  refresh: () => Promise<void>;
  find: (id: string | undefined) => ProjectEntry | undefined;
};

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<readonly ProjectEntry[]>(BUNDLED_PROJECTS);
  const [source, setSource] = useState<CatalogSource>('bundled');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const remote = await fetchRemoteCatalog();
    if (remote) {
      setProjects(remote);
      setSource('remote');
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let alive = true;
    // 번들본으로 즉시 렌더 → 캐시 → 원격 순으로 덮어쓴다.
    void (async () => {
      const cached = await readCachedCatalog();
      if (alive && cached) {
        setProjects(cached);
        setSource('cache');
      }
      const remote = await fetchRemoteCatalog();
      if (alive && remote) {
        setProjects(remote);
        setSource('remote');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<CatalogState>(
    () => ({
      projects,
      source,
      refreshing,
      refresh,
      find: (id) => findProject(projects, id),
    }),
    [projects, source, refreshing, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog는 CatalogProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
