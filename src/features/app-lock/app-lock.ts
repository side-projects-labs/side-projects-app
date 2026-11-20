/** 백그라운드에서 돌아왔을 때 다시 잠글지 판정한다. 잠깐 다른 앱을 보고 오는 경우를 위해 유예 시간을 둔다. */
export function shouldLockOnResume(s: {
  enabled: boolean;
  backgroundedAt: number | null;
  now: number;
  graceMs: number;
}): boolean {
  if (!s.enabled || s.backgroundedAt === null) return false;
  const elapsed = s.now - s.backgroundedAt;
  // 시계가 거꾸로 간 경우(elapsed < 0)는 안전한 쪽(잠금)으로 처리한다.
  return elapsed < 0 || elapsed >= s.graceMs;
}

export type AuthResult = { success: boolean; error?: string };

/**
 * 인증 결과에 따른 동작.
 * - unlock: 해제
 * - disable: 기기에 화면 잠금 수단이 없거나 사라져 인증이 불가능하므로 잠금 기능을 끄고 해제한다(앱에서 쫓겨나지 않게)
 * - stay: 취소·실패·잠김·알 수 없는 오류는 잠금을 유지한다
 */
export function decideAuthOutcome(r: AuthResult): 'unlock' | 'disable' | 'stay' {
  if (r.success) return 'unlock';
  if (r.error === 'not_enrolled' || r.error === 'passcode_not_set') return 'disable';
  return 'stay';
}

export function parseLockEnabled(raw: string | null): boolean {
  return raw === '1';
}
