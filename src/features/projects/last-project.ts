import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseLastVisit, type LastVisit } from './resume';

// 형식을 바꾸면 버전을 올린다. 이전 키(last-project-v1, id만 저장)는 읽지 않는다.
const KEY = 'last-visit-v1';

export async function loadLastVisit(): Promise<LastVisit | null> {
  try {
    return parseLastVisit(await AsyncStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export async function saveLastVisit(visit: LastVisit): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(visit));
  } catch {
    // 저장 실패는 "이어서 보기"만 잃을 뿐이라 무시한다.
  }
}
