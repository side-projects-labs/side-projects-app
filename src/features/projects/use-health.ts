import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProjectEntry } from './catalog';
import { checkHealth, type HealthStatus } from './health';

/** 목록의 각 서비스 상태를 병렬로 확인한다. refresh로 다시 확인한다. */
export function useHealth(projects: readonly ProjectEntry[]) {
  const [status, setStatus] = useState<Record<string, HealthStatus>>({});
  // 가장 최근에 시작한 확인만 결과를 반영한다. 늦게 도착한 이전 결과가 덮어쓰지 않게 한다.
  const runRef = useRef(0);

  // 카탈로그가 번들→캐시→원격으로 갱신돼도 id·url이 같으면 같은 목록으로 보고 다시 확인하지 않는다.
  const key = projects.map((p) => `${p.id}|${p.url}`).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key가 id·url 변화를 대표한다.
  const targets = useMemo(() => projects.map((p) => ({ id: p.id, url: p.url })), [key]);

  const check = useCallback(async () => {
    const run = ++runRef.current;
    await Promise.all(
      targets.map(async (p) => {
        const result = await checkHealth(p.url);
        if (runRef.current === run) setStatus((prev) => ({ ...prev, [p.id]: result }));
      }),
    );
  }, [targets]);

  // 언마운트·목록 변경 시 진행 중인 결과를 버린다.
  const cancel = useCallback(() => {
    runRef.current++;
  }, []);

  useEffect(() => {
    void check();
    return cancel;
  }, [check, cancel]);

  // 값이 없는 항목은 화면에서 '확인 중'으로 본다. 당겨서 새로고침할 때만 명시적으로 되돌린다.
  const refresh = useCallback(() => {
    setStatus({});
    return check();
  }, [check]);
  return { status, refresh };
}
