import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// 실행 위치(cwd)가 아니라 이 파일의 위치를 기준으로 해서 저장소 루트가 아닌 곳에서 돌려도 같은 파일을 검사한다.
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');

/** src 아래의 .ts·.tsx 파일. 테마(src/theme)와 테스트 파일은 색 정의·검증을 위해 제외한다. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'theme' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// #RGB·#RRGGBB(·알파) 리터럴, rgb()/rgba()/hsl() 함수, 스타일 객체(color: 'x')와 JSX 속성(color="x")의 색 이름
// 앞이 글자·숫자·슬래시면 URL 해시나 키(`/#abc`, `page#add`, `o/new#999`)라 색이 아니다. 길이는 유효한 3·4·6·8자리만 본다.
const HEX = /(?<![\w/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const FUNCTION = /\b(rgba?|hsla?)\(/;
const NAMED = /\b(color|backgroundColor|borderColor|tintColor)\s*[:=]\s*['"](?!transparent['"])[a-zA-Z]+['"]/;

describe('화면 코드의 색', () => {
  it('src/theme 밖에는 색 리터럴이 없고 모든 색은 팔레트 토큰을 쓴다', () => {
    const violations = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          HEX.test(line) || FUNCTION.test(line) || NAMED.test(line)
            ? [`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`]
            : [],
        ),
    );

    expect(violations).toEqual([]);
  });

  it('검사 대상 파일을 실제로 찾는다(빈 목록으로 통과하지 않게)', () => {
    const files = sourceFiles(SRC).map((f) => relative(SRC, f));

    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain(join('app', 'index.tsx'));
    expect(files.some((f) => f.startsWith('theme'))).toBe(false);
  });

  it.each([
    "color: '#fff'",
    "backgroundColor: '#F5B301'",
    "borderColor: \"#0B6BCB\"",
    "color: '#00000080'",
    "color: '#abcd'",
    'border: 1px solid #fff',
  ])('색 리터럴(%s)을 잡는다', (code) => {
    expect(HEX.test(code)).toBe(true);
  });

  it.each([
    'https://example.com/#abc',
    'https://example.com/page#add',
    '`${repo}#${id}`',
    'o/new#999',
    'id#abc',
    "const x = '#12345';",
    "const x = '#1234567';",
    'const id = 7;',
  ])('색이 아닌 문자열(%s)은 색으로 보지 않는다', (code) => {
    expect(HEX.test(code)).toBe(false);
  });

  it('검사 패턴이 색 리터럴을 실제로 잡는다', () => {
    expect(HEX.test("color: '#fff'")).toBe(true);
    expect(HEX.test("backgroundColor: '#F5B301'")).toBe(true);
    expect(FUNCTION.test('rgba(0, 0, 0, 0.5)')).toBe(true);
    expect(NAMED.test("color: 'white'")).toBe(true);
    expect(NAMED.test('<Ionicons color="white" />')).toBe(true);
    expect(NAMED.test("<Ionicons color='red' />")).toBe(true);
    expect(NAMED.test('<Ionicons color={t.accent} />')).toBe(false);
    expect(NAMED.test("backgroundColor: 'transparent'")).toBe(false);
    expect(HEX.test('const id = 7;')).toBe(false);
  });
});
