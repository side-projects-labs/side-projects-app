import AsyncStorage from '@react-native-async-storage/async-storage';

import { findProject, type ProjectEntry } from './catalog';

const KEY = 'last-project-v1';

/** 저장된 id가 아직 카탈로그에 있을 때만 프로젝트를 돌려준다. 저장값은 신뢰하지 않는다. */
export function resolveLastProject(
  projects: readonly ProjectEntry[],
  storedId: unknown,
): ProjectEntry | undefined {
  return typeof storedId === 'string' ? findProject(projects, storedId) : undefined;
}

export async function loadLastProjectId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveLastProjectId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // 저장 실패는 "이어서 보기"만 잃을 뿐이라 무시한다.
  }
}
