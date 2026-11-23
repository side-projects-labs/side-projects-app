const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** `#RGB`·`#RRGGBB`를 0~255 채널로 바꾼다. 다른 형식은 던진다. */
function toChannels(color: string): [number, number, number] {
  const m = HEX.exec(color);
  if (!m) throw new Error(`#RGB 또는 #RRGGBB 형식이 아닙니다: ${color}`);
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x 상대 휘도. */
function luminance(color: string): number {
  const [r, g, b] = toChannels(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 두 색의 WCAG 대비 비율(1~21). 글자는 4.5 이상(큰 글자 3 이상), 아이콘 같은 그래픽은 3 이상이 기준이다.
 * 팔레트의 색 조합이 이 기준을 지키는지 테스트로 고정하는 데 쓴다.
 */
export function contrastRatio(foreground: string, background: string): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}
