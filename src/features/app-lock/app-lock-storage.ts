import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseLockEnabled } from './app-lock';

// 형식을 바꾸면 버전을 올린다.
const KEY = 'app-lock-v1';

export async function loadLockEnabled(): Promise<boolean> {
  try {
    return parseLockEnabled(await AsyncStorage.getItem(KEY));
  } catch {
    // 읽지 못하면 사용자가 켜 둔 잠금이 풀리지 않도록 켜진 것으로 본다.
    return true;
  }
}

export async function saveLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    // 저장 실패 시 이번 실행에서만 유지된다.
  }
}
