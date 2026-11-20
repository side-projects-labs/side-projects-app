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
