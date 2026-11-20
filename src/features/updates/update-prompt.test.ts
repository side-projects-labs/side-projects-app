import { describe, expect, it } from 'vitest';

import { shouldShowUpdatePrompt } from './update-prompt';

const base = {
  isEnabled: true,
  isUpdatePending: true,
  pendingUpdateId: 'u2',
  dismissedUpdateId: null as string | null,
};

describe('shouldShowUpdatePrompt', () => {
  it('내려받은 업데이트가 대기 중이면 안내한다', () => {
    expect(shouldShowUpdatePrompt(base)).toBe(true);
  });
  it('대기 중인 업데이트가 없으면 안내하지 않는다', () => {
    expect(shouldShowUpdatePrompt({ ...base, isUpdatePending: false })).toBe(false);
  });
  it('업데이트가 꺼진 환경(개발 모드)에서는 안내하지 않는다', () => {
    expect(shouldShowUpdatePrompt({ ...base, isEnabled: false })).toBe(false);
  });
  it('같은 업데이트를 "나중에"로 닫았으면 다시 안내하지 않는다', () => {
    expect(shouldShowUpdatePrompt({ ...base, dismissedUpdateId: 'u2' })).toBe(false);
  });
  it('이후 더 새 업데이트가 내려받아지면 다시 안내한다', () => {
    expect(shouldShowUpdatePrompt({ ...base, dismissedUpdateId: 'u1', pendingUpdateId: 'u2' })).toBe(true);
  });
  it('업데이트 id를 알 수 없어도 대기 중이면 안내한다', () => {
    expect(shouldShowUpdatePrompt({ ...base, pendingUpdateId: null })).toBe(true);
  });
});
