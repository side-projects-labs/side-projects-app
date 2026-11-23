import { describe, expect, it } from 'vitest';

import { createLatestGuard } from './latest-guard';

describe('createLatestGuard', () => {
  it('하나만 시작하면 그 결과를 반영한다', () => {
    const guard = createLatestGuard();

    const isCurrent = guard.begin();

    expect(isCurrent()).toBe(true);
  });

  it('나중에 시작한 것이 있으면 먼저 시작한 것은 오래된 결과로 본다', () => {
    const guard = createLatestGuard();

    const first = guard.begin();
    const second = guard.begin();

    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('먼저 시작한 읽기가 나중에 끝나도 오래된 결과로 덮어쓰지 않는다', async () => {
    const guard = createLatestGuard();
    let shown = 'initial';
    // A는 느리게, B는 빠르게 끝난다. A가 B 뒤에 도착한다.
    const read = (label: string, delayMs: number) => {
      const isCurrent = guard.begin();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          if (isCurrent()) shown = label;
          resolve();
        }, delayMs),
      );
    };

    await Promise.all([read('A(오래된 값)', 20), read('B(최신 값)', 5)]);

    expect(shown).toBe('B(최신 값)');
  });

  it('cancel하면 진행 중인 모든 읽기가 오래된 결과가 된다(화면을 떠날 때)', () => {
    const guard = createLatestGuard();
    const a = guard.begin();
    const b = guard.begin();

    guard.cancel();

    expect(a()).toBe(false);
    expect(b()).toBe(false);
  });

  it('cancel 뒤에 새로 시작한 읽기는 다시 반영된다', () => {
    const guard = createLatestGuard();
    guard.begin();
    guard.cancel();

    const after = guard.begin();

    expect(after()).toBe(true);
  });

  it('가드마다 서로 영향을 주지 않는다', () => {
    const a = createLatestGuard();
    const b = createLatestGuard();

    const fromA = a.begin();
    b.begin();
    b.begin();

    expect(fromA()).toBe(true);
  });

  it('이미 끝난 읽기의 판정은 이후에 시작한 읽기로 바뀐다', () => {
    const guard = createLatestGuard();
    const first = guard.begin();
    expect(first()).toBe(true);

    guard.begin();

    expect(first()).toBe(false);
  });
});
