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

/** 저장된 마지막 페이지가 이 프로젝트의 것이면 지운다(로그인 초기화 뒤 옛 주소로 열리지 않게). */
export async function clearLastVisitFor(projectId: string): Promise<void> {
  try {
    const visit = await loadLastVisit();
    if (visit?.projectId === projectId) await AsyncStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
