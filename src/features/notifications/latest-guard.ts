export type LatestGuard = {
  /** 비동기 읽기를 시작할 때 부른다. 돌려받은 함수는 그 읽기가 아직 가장 최근이면 true를 돌려준다. */
  begin(): () => boolean;
  /** 진행 중인 모든 읽기의 결과를 버린다(화면을 떠날 때). */
  cancel(): void;
};

/**
 * 같은 값을 읽는 비동기 작업이 겹쳐도 가장 최근에 시작한 것의 결과만 반영하게 한다. 먼저 시작한 읽기가 나중에
 * 끝나 더 새로운 값을 오래된 값으로 덮어쓰는 것을 막는다(`use-health.ts`의 `runRef`와 같은 방식).
 */
export function createLatestGuard(): LatestGuard {
  let latest = 0;
  return {
    begin() {
      const mine = ++latest;
      return () => mine === latest;
    },
    cancel() {
      latest++;
    },
  };
}
