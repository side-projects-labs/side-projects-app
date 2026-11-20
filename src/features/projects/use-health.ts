import { useCallback, useEffect, useState } from 'react';

import type { ProjectEntry } from './catalog';
import { checkHealth, type HealthStatus } from './health';

/** 목록의 각 서비스 상태를 병렬로 확인한다. refresh로 다시 확인한다. */
export function useHealth(projects: readonly ProjectEntry[]) {
  const [status, setStatus] = useState<Record<string, HealthStatus>>({});

  const check = useCallback(async (list: readonly ProjectEntry[], alive: () => boolean) => {
    await Promise.all(
      list.map(async (p) => {
        const result = await checkHealth(p.url);
        if (alive()) setStatus((prev) => ({ ...prev, [p.id]: result }));
      }),
    );
  }, []);

  useEffect(() => {
    let alive = true;
    void check(projects, () => alive);
    return () => {
      alive = false;
    };
  }, [projects, check]);

  // 값이 없는 항목은 화면에서 '확인 중'으로 본다. 당겨서 새로고침할 때만 명시적으로 되돌린다.
  const refresh = useCallback(() => {
    setStatus({});
    return check(projects, () => true);
  }, [projects, check]);
  return { status, refresh };
}
