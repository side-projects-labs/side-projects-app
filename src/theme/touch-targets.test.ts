import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// 실행 위치(cwd)가 아니라 이 파일의 위치를 기준으로 한다.
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');

/** src 아래의 .tsx 파일. 테스트 파일은 제외한다. */
function screens(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screens(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

// `hitSlop={8}`처럼 숫자를 직접 쓰거나, `hitSlop={{ top: 6 }}`처럼 객체 안에 숫자를 직접 쓰는 경우
const LITERAL_SLOP = /hitSlop=\{\s*\d|hitSlop=\{\{[^}]*\b(top|bottom|left|right)\s*:\s*\d/;

describe('터치 영역', () => {
  it('hitSlop은 숫자를 직접 쓰지 않고 hitSlopFor로 계산한다', () => {
    const violations = screens(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (LITERAL_SLOP.test(line) ? [`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`] : [])),
    );

    expect(violations).toEqual([]);
  });

  it('검사 대상 파일을 실제로 찾는다(빈 목록으로 통과하지 않게)', () => {
    const files = screens(SRC).map((f) => relative(SRC, f));

    expect(files.length).toBeGreaterThan(8);
    expect(files).toContain(join('app', 'index.tsx'));
  });

  it.each(['hitSlop={8}', 'hitSlop={ 10 }', 'hitSlop={{ top: 6, bottom: 6 }}', 'hitSlop={{ left: 12 }}'])(
    '직접 쓴 숫자(%s)를 잡는다',
    (code) => {
      expect(LITERAL_SLOP.test(code)).toBe(true);
    },
  );

  it.each([
    'hitSlop={hitSlopFor(24)}',
    'hitSlop={{ top: hitSlopFor(18), bottom: hitSlopFor(18) }}',
    'hitSlop={slop}',
    '<Pressable onPress={go}>',
  ])('계산해서 쓴 값(%s)은 잡지 않는다', (code) => {
    expect(LITERAL_SLOP.test(code)).toBe(false);
  });
});
