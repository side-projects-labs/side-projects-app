import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './catalog';
import { movePinned, parsePinned, sanitizePinned, sortProjects, togglePin } from './pins';

const p = (id: string): ProjectEntry => ({
  id,
  name: id,
  description: 'd',
  icon: 'i',
  url: 'https://a.example',
});

describe('togglePin', () => {
  it('고정하면 맨 아래(고정 목록의 끝)에 추가한다', () => {
    expect(togglePin(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('이미 고정한 것은 해제한다', () => {
    expect(togglePin(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('movePinned', () => {
  it('위로 한 칸 옮긴다', () => {
    expect(movePinned(['a', 'b', 'c'], 'c', 'up')).toEqual(['a', 'c', 'b']);
  });
  it('아래로 한 칸 옮긴다', () => {
    expect(movePinned(['a', 'b', 'c'], 'a', 'down')).toEqual(['b', 'a', 'c']);
  });
  it('맨 위·맨 아래에서는 그대로 둔다', () => {
    expect(movePinned(['a', 'b'], 'a', 'up')).toEqual(['a', 'b']);
    expect(movePinned(['a', 'b'], 'b', 'down')).toEqual(['a', 'b']);
  });
  it('고정하지 않은 id는 무시한다', () => {
    expect(movePinned(['a', 'b'], 'z', 'up')).toEqual(['a', 'b']);
  });
});

describe('sortProjects', () => {
  const list = [p('a'), p('b'), p('c'), p('d')];
  it('고정한 프로젝트를 고정 순서대로 위에 두고, 나머지는 원래 순서를 유지한다', () => {
    expect(sortProjects(list, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('고정이 없으면 원래 순서', () => {
    expect(sortProjects(list, []).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('카탈로그에 없는 고정 id는 무시한다', () => {
    expect(sortProjects(list, ['zzz', 'b']).map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']);
  });
  it('입력 배열을 바꾸지 않는다', () => {
    const copy = [...list];
    sortProjects(list, ['d']);
    expect(list).toEqual(copy);
  });
});

describe('sanitizePinned', () => {
  it('카탈로그에 있는 id만, 중복 없이 남긴다', () => {
    expect(sanitizePinned(['a', 'zzz', 'a', 'b'], [p('a'), p('b')])).toEqual(['a', 'b']);
  });
});

describe('parsePinned', () => {
  it('문자열 배열 JSON을 파싱한다', () => {
    expect(parsePinned(JSON.stringify(['a', 'b']))).toEqual(['a', 'b']);
  });
  it('손상되었거나 형식이 틀리면 빈 목록', () => {
    expect(parsePinned(null)).toEqual([]);
    expect(parsePinned('{oops')).toEqual([]);
    expect(parsePinned(JSON.stringify({ a: 1 }))).toEqual([]);
  });
  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(parsePinned(JSON.stringify(['a', 1, null, 'b']))).toEqual(['a', 'b']);
  });
});
