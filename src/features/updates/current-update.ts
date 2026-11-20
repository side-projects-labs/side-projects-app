import * as Updates from 'expo-updates';

import { formatUpdateInfo, type InfoRow } from './update-info';

/** 현재 실행 중인 코드의 업데이트 정보. 값은 앱 시작 시 정해지므로 상태로 관리하지 않는다. */
export function getUpdateInfoRows(): InfoRow[] {
  return formatUpdateInfo({
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ?? null,
  });
}
