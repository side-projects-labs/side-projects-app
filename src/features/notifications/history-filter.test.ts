import { describe, expect, it } from 'vitest';

import { filterHistory, projectsInHistory } from './history-filter';
import type { HistoryItem } from './history';

const item = (n: number, over: Partial<HistoryItem> = {}): HistoryItem => ({
  eventId: `e${n}`,
  projectId: 'a',
  status: 'succeeded',
  title: 't',
  body: 'b',
  receivedAt: n,
  ...over,
});

const list = [
  item(1, { projectId: 'a', status: 'started' }),
  item(2, { projectId: 'b', status: 'succeeded' }),
  item(3, { projectId: 'a', status: 'failed' }),
  item(4, { projectId: 'b', status: 'failed' }),
];

describe('filterHistory', () => {
  it('필터가 없으면 그대로 돌려준다', () => {
    expect(filterHistory(list, {})).toEqual(list);
  });
  it('상태로 거른다', () => {
    expect(filterHistory(list, { status: 'failed' }).map((i) => i.eventId)).toEqual(['e3', 'e4']);
  });
  it('프로젝트로 거른다', () => {
    expect(filterHistory(list, { projectId: 'a' }).map((i) => i.eventId)).toEqual(['e1', 'e3']);
  });
  it('둘을 함께 적용한다', () => {
    expect(filterHistory(list, { projectId: 'b', status: 'failed' }).map((i) => i.eventId)).toEqual(['e4']);
  });
  it('일치하는 항목이 없으면 빈 목록', () => {
    expect(filterHistory(list, { projectId: 'zzz' })).toEqual([]);
  });
});

describe('projectsInHistory', () => {
  it('이력에 나온 프로젝트 id를 중복 없이 처음 나온 순서로 돌려준다', () => {
    expect(projectsInHistory(list)).toEqual(['a', 'b']);
  });
  it('빈 이력이면 빈 목록', () => {
    expect(projectsInHistory([])).toEqual([]);
  });
});
