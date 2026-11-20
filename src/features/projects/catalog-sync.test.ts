import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildCatalog,
  diffCatalog,
  parseOverrides,
  selectRepos,
  serializeCatalog,
  SYNC_TOPIC,
  type RepoInfo,
  type SyncEntry,
} from './catalog-sync';

const repo = (over: Partial<RepoInfo> = {}): RepoInfo => ({
  name: 'a',
  full_name: 'side-projects-labs/a',
  description: '설명 a',
  homepage: 'https://a.example.com',
  topics: [SYNC_TOPIC],
  archived: false,
  fork: false,
  ...over,
});

describe('selectRepos', () => {
  it('토픽이 있는 저장소만 고른다', () => {
    const list = [repo({ name: 'x' }), repo({ name: 'y', topics: [] }), repo({ name: 'z', topics: ['other'] })];
    expect(selectRepos(list).map((r) => r.name)).toEqual(['x']);
  });
  it('보관(archived)·포크 저장소는 제외한다', () => {
    const list = [repo({ name: 'x', archived: true }), repo({ name: 'y', fork: true }), repo({ name: 'z' })];
    expect(selectRepos(list).map((r) => r.name)).toEqual(['z']);
  });
});

describe('parseOverrides', () => {
  it('허용한 필드만 남기고 잘못된 값은 버린다', () => {
    const o = parseOverrides({
      a: { name: 'A', icon: '🅰️', url: 'https://a.example', allowedHosts: ['x.example.com', 3], bogus: 1 },
      b: 'not-object',
    });
    expect(o).toEqual({ a: { name: 'A', icon: '🅰️', url: 'https://a.example', allowedHosts: ['x.example.com'] } });
  });
  it('객체가 아니면 빈 설정', () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides([])).toEqual({});
  });
});

describe('buildCatalog', () => {
  const ok = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));

  it('저장소의 homepage·description으로 항목을 만든다(기본 아이콘 포함)', () => {
    const r = buildCatalog({ repos: [repo()], overrides: {}, existing: [], reachable: ok(['a']) });
    expect(r.projects).toEqual([
      {
        id: 'a',
        name: 'a',
        description: '설명 a',
        icon: '📦',
        url: 'https://a.example.com',
        repo: 'side-projects-labs/a',
      },
    ]);
    expect(r.problems).toEqual([]);
  });

  it('덮어쓰기 값이 저장소 값보다 우선한다(오래된 homepage 보정)', () => {
    const r = buildCatalog({
      repos: [repo({ homepage: 'https://stale.example.com' })],
      overrides: { a: { name: 'A', description: '새 설명', icon: '🅰️', url: 'https://good.example.com', allowedHosts: ['login.example.com'] } },
      existing: [],
      reachable: ok(['a']),
    });
    expect(r.projects[0]).toMatchObject({
      name: 'A',
      description: '새 설명',
      icon: '🅰️',
      url: 'https://good.example.com',
      allowedHosts: ['login.example.com'],
    });
  });

  it('주소가 없거나 HTTPS가 아니면 건너뛰고 문제로 보고한다', () => {
    const r = buildCatalog({
      repos: [repo({ name: 'n', homepage: null }), repo({ name: 'h', homepage: 'http://h.example.com' }), repo({ name: 'c', homepage: 'https://u:p@c.example.com' })],
      overrides: {},
      existing: [],
      reachable: {},
    });
    expect(r.projects).toEqual([]);
    expect(r.problems.map((p) => p.id).sort()).toEqual(['c', 'h', 'n']);
  });

  it('설명이 비어 있으면 건너뛴다', () => {
    const r = buildCatalog({ repos: [repo({ description: null })], overrides: {}, existing: [], reachable: ok(['a']) });
    expect(r.projects).toEqual([]);
    expect(r.problems[0].id).toBe('a');
  });

  it('응답하지 않는 주소는 기존 항목이 있으면 유지하고, 없으면 제외한다', () => {
    const existing: SyncEntry[] = [
      { id: 'a', name: 'A', description: 'd', icon: '🅰️', url: 'https://old.example.com', repo: 'side-projects-labs/a' },
    ];
    const kept = buildCatalog({ repos: [repo()], overrides: {}, existing, reachable: { a: false } });
    expect(kept.projects).toEqual(existing);
    expect(kept.problems.map((p) => p.id)).toEqual(['a']);

    const dropped = buildCatalog({ repos: [repo()], overrides: {}, existing: [], reachable: { a: false } });
    expect(dropped.projects).toEqual([]);
    expect(dropped.problems.map((p) => p.id)).toEqual(['a']);
  });

  it('기존 순서를 유지하고 새 항목은 이름순으로 뒤에 붙인다', () => {
    const existing: SyncEntry[] = [
      { id: 'b', name: 'b', description: 'd', icon: '📦', url: 'https://b.example.com' },
      { id: 'a', name: 'a', description: 'd', icon: '📦', url: 'https://a.example.com' },
    ];
    const repos = [repo({ name: 'z', homepage: 'https://z.example.com' }), repo({ name: 'a' }), repo({ name: 'b', homepage: 'https://b.example.com' }), repo({ name: 'm', homepage: 'https://m.example.com' })];
    const r = buildCatalog({ repos, overrides: {}, existing, reachable: ok(['a', 'b', 'm', 'z']) });
    expect(r.projects.map((p) => p.id)).toEqual(['b', 'a', 'm', 'z']);
  });

  it('토픽이 사라진 저장소는 목록에서 빠진다', () => {
    const existing: SyncEntry[] = [{ id: 'gone', name: 'g', description: 'd', icon: '📦', url: 'https://g.example.com' }];
    const r = buildCatalog({ repos: [repo()], overrides: {}, existing, reachable: ok(['a']) });
    expect(r.projects.map((p) => p.id)).toEqual(['a']);
  });
});

describe('diffCatalog', () => {
  const e = (id: string, url = 'https://x.example.com'): SyncEntry => ({ id, name: id, description: 'd', icon: '📦', url });
  it('추가·제거·변경된 id를 구분한다', () => {
    const d = diffCatalog([e('a'), e('b'), e('c', 'https://old')], [e('b'), e('c', 'https://new'), e('d')]);
    expect(d).toEqual({ added: ['d'], removed: ['a'], changed: ['c'] });
  });
  it('같으면 모두 빈 목록', () => {
    expect(diffCatalog([e('a')], [e('a')])).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('serializeCatalog', () => {
  it('키 순서가 고정이고 끝에 줄바꿈이 있다', () => {
    const s = serializeCatalog([
      { id: 'a', name: 'A', description: 'd', icon: 'i', url: 'https://a.example.com', repo: 'o/a', allowedHosts: ['h.example.com'] },
    ]);
    expect(s.endsWith('}\n')).toBe(true);
    const keys = Object.keys(JSON.parse(s).projects[0]);
    expect(keys).toEqual(['id', 'name', 'description', 'icon', 'url', 'repo', 'allowedHosts']);
  });
  it('현재 catalog/projects.json과 형식이 같아 불필요한 차이를 만들지 않는다', () => {
    const raw = readFileSync(new URL('../../../catalog/projects.json', import.meta.url), 'utf8');
    const projects = JSON.parse(raw).projects as SyncEntry[];
    expect(serializeCatalog(projects)).toBe(raw);
  });
});
