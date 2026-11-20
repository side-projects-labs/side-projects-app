import { describe, expect, it } from 'vitest';

import { formatUpdateInfo } from './update-info';

describe('formatUpdateInfo', () => {
  it('OTA로 받은 코드로 실행 중이면 그렇게 표시한다', () => {
    const rows = formatUpdateInfo({
      isEnabled: true,
      isEmbeddedLaunch: false,
      channel: 'preview',
      runtimeVersion: '1.0.0',
      updateId: 'f2c8b309-41fe-4ec0-863a-ac5d59869fe5',
      createdAt: new Date('2026-11-20T11:20:00Z'),
    });
    expect(rows).toEqual([
      { label: '실행 중인 코드', value: 'OTA 업데이트' },
      { label: '채널', value: 'preview' },
      { label: '런타임 버전', value: '1.0.0' },
      { label: '업데이트 ID', value: 'f2c8b309' },
      { label: '게시 시각', value: '2026-11-20 11:20 UTC' },
    ]);
  });

  it('빌드에 포함된 코드면 업데이트 ID와 게시 시각은 생략한다', () => {
    const rows = formatUpdateInfo({
      isEnabled: true,
      isEmbeddedLaunch: true,
      channel: 'preview',
      runtimeVersion: '1.0.0',
      updateId: null,
      createdAt: null,
    });
    expect(rows[0]).toEqual({ label: '실행 중인 코드', value: '빌드에 포함된 코드' });
    expect(rows.map((r) => r.label)).toEqual(['실행 중인 코드', '채널', '런타임 버전']);
  });

  it('업데이트가 꺼진 환경(개발 모드)이면 비활성 한 줄만 보여 준다', () => {
    const rows = formatUpdateInfo({
      isEnabled: false,
      isEmbeddedLaunch: true,
      channel: null,
      runtimeVersion: null,
      updateId: null,
      createdAt: null,
    });
    expect(rows).toEqual([{ label: '업데이트', value: '이 환경에서는 꺼져 있어요(개발 모드)' }]);
  });

  it('채널·런타임 값이 없으면 "-"로 표시한다', () => {
    const rows = formatUpdateInfo({
      isEnabled: true,
      isEmbeddedLaunch: true,
      channel: null,
      runtimeVersion: null,
      updateId: null,
      createdAt: null,
    });
    expect(rows.find((r) => r.label === '채널')?.value).toBe('-');
    expect(rows.find((r) => r.label === '런타임 버전')?.value).toBe('-');
  });

  it('잘못된 날짜는 게시 시각을 생략한다', () => {
    const rows = formatUpdateInfo({
      isEnabled: true,
      isEmbeddedLaunch: false,
      channel: 'preview',
      runtimeVersion: '1.0.0',
      updateId: 'abcdef12-0000',
      createdAt: new Date('invalid'),
    });
    expect(rows.map((r) => r.label)).not.toContain('게시 시각');
  });
});
