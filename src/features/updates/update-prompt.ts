export type UpdatePromptState = {
  isEnabled: boolean;
  /** 새 업데이트를 내려받았고 다음 실행에 적용되기를 기다리는 중 */
  isUpdatePending: boolean;
  pendingUpdateId: string | null;
  /** 사용자가 "나중에"로 닫은 업데이트 id */
  dismissedUpdateId: string | null;
};

/** 다시 시작 안내를 보여 줄지 판정한다. 같은 업데이트는 닫은 뒤 다시 묻지 않고, 더 새 업데이트가 오면 다시 안내한다. */
export function shouldShowUpdatePrompt(s: UpdatePromptState): boolean {
  if (!s.isEnabled || !s.isUpdatePending) return false;
  return s.pendingUpdateId === null || s.pendingUpdateId !== s.dismissedUpdateId;
}

export type UpdateCheckState = {
  isEnabled: boolean;
  lastCheckedAt: number | null;
  now: number;
  minIntervalMs: number;
};

/** 앱이 포그라운드로 돌아올 때 서버에 새 업데이트가 있는지 확인할지 판정한다. 잦은 요청을 막으려고 최소 간격을 둔다. */
export function shouldCheckForUpdate(s: UpdateCheckState): boolean {
  if (!s.isEnabled) return false;
  if (s.lastCheckedAt === null) return true;
  const elapsed = s.now - s.lastCheckedAt;
  return elapsed >= s.minIntervalMs;
}
