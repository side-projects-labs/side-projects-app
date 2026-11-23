import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('검정과 흰색은 21:1이다', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('같은 색은 1:1이다', () => {
    expect(contrastRatio('#208AEF', '#208AEF')).toBeCloseTo(1, 5);
  });

  it('전경과 배경의 순서를 바꿔도 같다', () => {
    expect(contrastRatio('#0B6BCB', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#0B6BCB'), 10);
  });

  it('알려진 조합의 값을 계산한다(WCAG 상대 휘도 기준)', () => {
    expect(contrastRatio('#FFFFFF', '#208AEF')).toBeCloseTo(3.53, 2);
    expect(contrastRatio('#FFFFFF', '#5AA9FF')).toBeCloseTo(2.46, 2);
    expect(contrastRatio('#0B6BCB', '#FFFFFF')).toBeCloseTo(5.28, 2);
  });

  it('대소문자와 3자리 표기를 같은 색으로 본다', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it.each(['', 'red', '#12', '#12345', '#GGGGGG', 'rgb(0,0,0)', '#1234567'])('올바른 #RGB·#RRGGBB가 아니면(%s) 던진다', (bad) => {
    expect(() => contrastRatio(bad, '#FFFFFF')).toThrow();
    expect(() => contrastRatio('#FFFFFF', bad)).toThrow();
  });
});
