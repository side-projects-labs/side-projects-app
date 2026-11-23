import { describe, expect, it, vi } from 'vitest';

import { runLoginReset, type LoginResetSteps } from './login-reset-flow';

/** 호출 순서를 기록하는 가짜 단계들. 비동기 단계는 한 틱 늦게 끝나 순서 어긋남을 드러낸다. */
function setup(failed = 0) {
  const calls: string[] = [];
  const steps: LoginResetSteps = {
    cancelPendingSave: vi.fn(() => void calls.push('cancelPendingSave')),
    clearWebViewCache: vi.fn(() => void calls.push('clearWebViewCache')),
    resetCookies: vi.fn(async () => {
      calls.push('resetCookies:start');
      await Promise.resolve();
      calls.push('resetCookies:end');
      return { failed };
    }),
    clearLastVisit: vi.fn(async () => {
      calls.push('clearLastVisit:start');
      await Promise.resolve();
      calls.push('clearLastVisit:end');
    }),
    restartWebView: vi.fn(() => void calls.push('restartWebView')),
    warnPartialFailure: vi.fn(() => void calls.push('warnPartialFailure')),
  };
  return { calls, steps };
}

describe('runLoginReset', () => {
  it('저장 취소 → 캐시 삭제 → 쿠키 삭제 → 마지막 방문 삭제 → 저장 취소 → WebView 재시작 순서로 실행한다', async () => {
    const { calls, steps } = setup();

    await runLoginReset(steps);

    expect(calls).toEqual([
      'cancelPendingSave',
      'clearWebViewCache',
      'resetCookies:start',
      'resetCookies:end',
      'clearLastVisit:start',
      'clearLastVisit:end',
      'cancelPendingSave',
      'restartWebView',
    ]);
  });

  it('마지막 방문 삭제 뒤에 저장 취소를 한 번 더 해서, 삭제 도중 예약된 저장이 남지 않게 한다', async () => {
    const { calls, steps } = setup();

    await runLoginReset(steps);

    const cancels = calls.flatMap((c, i) => (c === 'cancelPendingSave' ? [i] : []));
    expect(cancels).toHaveLength(2);
    expect(cancels[1]).toBeGreaterThan(calls.indexOf('clearLastVisit:end'));
    expect(cancels[1]).toBeLessThan(calls.indexOf('restartWebView'));
  });

  it('쿠키 삭제가 끝나기 전에는 마지막 방문 삭제와 재시작을 하지 않는다', async () => {
    const { calls, steps } = setup();

    await runLoginReset(steps);

    expect(calls.indexOf('resetCookies:end')).toBeLessThan(calls.indexOf('clearLastVisit:start'));
    expect(calls.indexOf('resetCookies:end')).toBeLessThan(calls.indexOf('restartWebView'));
  });

  it('지우지 못한 항목이 있으면 WebView를 다시 시작한 뒤에 알린다', async () => {
    const { calls, steps } = setup(2);

    const result = await runLoginReset(steps);

    expect(result).toEqual({ failed: 2 });
    expect(calls.at(-1)).toBe('warnPartialFailure');
    expect(calls.indexOf('restartWebView')).toBeLessThan(calls.indexOf('warnPartialFailure'));
    expect(steps.warnPartialFailure).toHaveBeenCalledTimes(1);
  });

  it('모두 지웠으면 알리지 않는다', async () => {
    const { steps } = setup(0);

    const result = await runLoginReset(steps);

    expect(result).toEqual({ failed: 0 });
    expect(steps.warnPartialFailure).not.toHaveBeenCalled();
  });

  it('각 단계는 한 번씩만 실행한다(저장 취소는 두 번)', async () => {
    const { steps } = setup();

    await runLoginReset(steps);

    expect(steps.cancelPendingSave).toHaveBeenCalledTimes(2);
    expect(steps.clearWebViewCache).toHaveBeenCalledTimes(1);
    expect(steps.resetCookies).toHaveBeenCalledTimes(1);
    expect(steps.clearLastVisit).toHaveBeenCalledTimes(1);
    expect(steps.restartWebView).toHaveBeenCalledTimes(1);
  });
});
