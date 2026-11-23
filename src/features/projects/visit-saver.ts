import type { LastVisit } from './resume';

export type VisitSaver = {
  /** 이동한 페이지를 기억한다. 바로 전에 기억한 주소와 같으면 무시하고, 새 주소면 지연 시간 뒤에 한 번만 저장한다. */
  schedule(visit: LastVisit): void;
  /** 대기 중인 값을 기다리지 않고 바로 저장한다(화면을 떠날 때). */
  flush(): void;
  /** 대기 중인 값을 저장하지 않고 버리고, 기억한 주소도 잊는다(로그인 초기화 뒤 옛 주소가 다시 저장되지 않게). */
  forget(): void;
};

/**
 * "이어서 보기"를 위한 마지막 페이지 저장 타이밍. SPA처럼 주소가 자주 바뀌어도 저장소를 매번 쓰지 않도록
 * 잠시 멈췄을 때 마지막 값만 한 번 저장한다. 저장 실패는 이어서 보기만 잃을 뿐이라 삼킨다.
 */
export function createVisitSaver(save: (visit: LastVisit) => void | Promise<void>, delayMs: number): VisitSaver {
  let lastScheduled: string | undefined;
  let pending: { visit: LastVisit; timer: ReturnType<typeof setTimeout> } | null = null;

  const run = (visit: LastVisit) => {
    try {
      void Promise.resolve(save(visit)).catch(() => undefined);
    } catch {
      // 저장 함수가 동기적으로 던져도 타이머 콜백 밖으로 새지 않게 한다.
    }
  };

  const flush = () => {
    const p = pending;
    if (!p) return;
    clearTimeout(p.timer);
    pending = null;
    run(p.visit);
  };

  return {
    schedule(visit) {
      if (visit.url === lastScheduled) return;
      lastScheduled = visit.url;
      if (pending) clearTimeout(pending.timer);
      pending = { visit, timer: setTimeout(flush, delayMs) };
    },
    flush,
    forget() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
      lastScheduled = undefined;
    },
  };
}
