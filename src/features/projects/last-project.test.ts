import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './catalog';
import { resolveLastProject } from './last-project';

const p = (id: string): ProjectEntry => ({
  id,
  name: id,
  description: 'd',
  icon: 'i',
  url: 'https://a.example',
});

describe('resolveLastProject', () => {
  const projects = [p('a'), p('b')];
  it('카탈로그에 있는 id면 그 프로젝트를 돌려준다', () => {
    expect(resolveLastProject(projects, 'b')?.id).toBe('b');
  });
  it('카탈로그에서 사라진 id는 무시한다', () => {
    expect(resolveLastProject(projects, 'gone')).toBeUndefined();
  });
  it('저장값이 없거나 문자열이 아니면 undefined', () => {
    expect(resolveLastProject(projects, null)).toBeUndefined();
    expect(resolveLastProject(projects, 42)).toBeUndefined();
  });
});
