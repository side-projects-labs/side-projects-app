import { describe, expect, it } from 'vitest';

import { MIN_TOUCH_TARGET, hitSlopFor, minGapFor, verticalHitSlop } from './touch';

describe('MIN_TOUCH_TARGET', () => {
  it('iOS(44pt)와 같은 최소 터치 영역이다', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});

describe('hitSlopFor', () => {
  it.each([
    [24, 10],
    [18, 13],
    [26, 9],
    [40, 2],
    [43, 1],
  ])('크기 %i인 요소는 한쪽에 %i를 더해 44 이상이 된다', (size, slop) => {
    expect(hitSlopFor(size)).toBe(slop);
    expect(size + 2 * slop).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('홀수 부족분은 올림해서 항상 최소 영역을 채운다', () => {
    for (let size = 1; size <= 60; size++) {
      expect(size + 2 * hitSlopFor(size)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('이미 충분히 크면 0이다', () => {
    expect(hitSlopFor(44)).toBe(0);
    expect(hitSlopFor(50)).toBe(0);
  });

  it('최소값을 바꿀 수 있다(Android 권장 48)', () => {
    expect(hitSlopFor(24, 48)).toBe(12);
  });

  it.each([0, -3, NaN, Infinity])('올바른 크기가 아니면(%s) 던진다', (bad) => {
    expect(() => hitSlopFor(bad)).toThrow();
  });
});

describe('minGapFor', () => {
  it('나란히 놓인 버튼의 확장된 터치 영역이 겹치지 않는 간격이다', () => {
    expect(minGapFor(24)).toBe(20);
    expect(minGapFor(24)).toBe(2 * hitSlopFor(24));
  });

  it('이미 충분히 크면 간격이 필요 없다', () => {
    expect(minGapFor(48)).toBe(0);
  });
});

describe('verticalHitSlop', () => {
  it('높이만 키운다. 글자 버튼이나 칩처럼 가로는 이미 충분한 요소에 쓴다', () => {
    expect(verticalHitSlop(28)).toEqual({ top: 8, bottom: 8 });
    expect(verticalHitSlop(18)).toEqual({ top: 13, bottom: 13 });
  });

  it('위아래가 같고 높이가 44 이상이 된다', () => {
    for (let height = 1; height <= 60; height++) {
      const { top, bottom } = verticalHitSlop(height);
      expect(top).toBe(bottom);
      expect(height + top + bottom).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('이미 충분히 크면 0이다', () => {
    expect(verticalHitSlop(44)).toEqual({ top: 0, bottom: 0 });
  });

  it('올바른 높이가 아니면 던진다', () => {
    expect(() => verticalHitSlop(0)).toThrow();
  });
});
