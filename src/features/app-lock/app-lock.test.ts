import { describe, expect, it } from 'vitest';

import { decideAuthOutcome, parseLockEnabled, shouldLockOnResume } from './app-lock';

const GRACE = 30_000;

describe('shouldLockOnResume', () => {
  it('잠금이 꺼져 있으면 잠그지 않는다', () => {
    expect(shouldLockOnResume({ enabled: false, backgroundedAt: 0, now: 10 * GRACE, graceMs: GRACE })).toBe(false);
  });
  it('유예 시간 안에 돌아오면 잠그지 않는다', () => {
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: 1000, now: 1000 + GRACE - 1, graceMs: GRACE })).toBe(false);
  });
  it('유예 시간이 지나 돌아오면 잠근다', () => {
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: 1000, now: 1000 + GRACE, graceMs: GRACE })).toBe(true);
  });
  it('백그라운드로 간 기록이 없으면(첫 실행 등) 잠그지 않는다', () => {
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: null, now: 5000, graceMs: GRACE })).toBe(false);
  });
  it('시계가 거꾸로 가면 안전하게 잠근다', () => {
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: 9000, now: 1000, graceMs: GRACE })).toBe(true);
  });
});

describe('decideAuthOutcome', () => {
  it('인증에 성공하면 해제한다', () => {
    expect(decideAuthOutcome({ success: true })).toBe('unlock');
  });
  it('기기에 잠금 수단이 없거나 사라졌으면 잠금 기능을 끄고 해제해 앱에서 쫓겨나지 않게 한다', () => {
    expect(decideAuthOutcome({ success: false, error: 'not_enrolled' })).toBe('disable');
    expect(decideAuthOutcome({ success: false, error: 'passcode_not_set' })).toBe('disable');
  });
  it('취소·실패·잠김은 잠금을 유지한다', () => {
    for (const error of ['user_cancel', 'system_cancel', 'app_cancel', 'authentication_failed', 'lockout', 'timeout']) {
      expect(decideAuthOutcome({ success: false, error })).toBe('stay');
    }
  });
  it('알 수 없는 오류도 잠금을 유지한다', () => {
    expect(decideAuthOutcome({ success: false, error: 'something_new' })).toBe('stay');
    expect(decideAuthOutcome({ success: false })).toBe('stay');
  });
});

describe('parseLockEnabled', () => {
  it('저장값이 "1"일 때만 켜진 것으로 본다', () => {
    expect(parseLockEnabled('1')).toBe(true);
    expect(parseLockEnabled('0')).toBe(false);
    expect(parseLockEnabled(null)).toBe(false);
    expect(parseLockEnabled('true')).toBe(false);
  });
});
