/** expo-updates가 알려 주는 현재 실행 정보. 순수 함수로 다루기 위해 필요한 값만 옮겨 담는다. */
export type UpdateInfo = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  createdAt: Date | null;
};

export type InfoRow = { label: string; value: string };

function formatUtc(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** 화면에 보여 줄 업데이트 정보. 값이 없거나 업데이트가 꺼진 환경(개발 모드)은 안전하게 대체한다. */
export function formatUpdateInfo(info: UpdateInfo): InfoRow[] {
  if (!info.isEnabled) {
    return [{ label: '업데이트', value: '이 환경에서는 꺼져 있어요(개발 모드)' }];
  }
  const rows: InfoRow[] = [
    {
      label: '실행 중인 코드',
      value: info.isEmbeddedLaunch ? '빌드에 포함된 코드' : 'OTA 업데이트',
    },
    { label: '채널', value: info.channel ?? '-' },
    { label: '런타임 버전', value: info.runtimeVersion ?? '-' },
  ];
  if (!info.isEmbeddedLaunch) {
    if (info.updateId) rows.push({ label: '업데이트 ID', value: info.updateId.slice(0, 8) });
    const when = info.createdAt ? formatUtc(info.createdAt) : null;
    if (when) rows.push({ label: '게시 시각', value: when });
  }
  return rows;
}
