import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { DARK, LIGHT, type Palette } from './palette';

const palettes: [string, Palette][] = [
  ['라이트', LIGHT],
  ['다크', DARK],
];

// WCAG 2.x 기준: 글자 4.5 이상, 아이콘·점 같은 그래픽 3 이상.
const TEXT = 4.5;
const GRAPHIC = 3;

describe.each(palettes)('%s 팔레트의 대비', (_name, p) => {
  it.each([
    ['본문 글자', 'text'],
    ['보조 글자', 'subtext'],
    ['강조 글자·링크', 'accent'],
  ] as const)('%s가 배경과 카드 위에서 글자 기준(4.5:1)을 지킨다', (_label, key) => {
    expect(contrastRatio(p[key], p.background)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(p[key], p.card)).toBeGreaterThanOrEqual(TEXT);
  });

  it('강조색 배경 위의 글자(onAccent)가 글자 기준을 지킨다', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(TEXT);
  });

  it('고정 별이 카드 위에서 그래픽 기준(3:1)을 지킨다', () => {
    expect(contrastRatio(p.pin, p.card)).toBeGreaterThanOrEqual(GRAPHIC);
  });

  it.each([
    ['확인 중', 'statusChecking'],
    ['정상', 'statusUp'],
    ['응답 없음', 'statusDown'],
  ] as const)('상태 점(%s)이 카드 위에서 그래픽 기준(3:1)을 지킨다', (_label, key) => {
    expect(contrastRatio(p[key], p.card)).toBeGreaterThanOrEqual(GRAPHIC);
  });

  it('모든 색이 #RRGGBB 형식이다', () => {
    for (const value of Object.values(p)) expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('상태 세 가지는 서로 다른 색이다', () => {
    expect(new Set([p.statusChecking, p.statusUp, p.statusDown]).size).toBe(3);
  });
});
