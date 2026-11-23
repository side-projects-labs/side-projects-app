export type Palette = {
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  /** 강조색(accent) 배경 위에 올리는 글자·아이콘 색. */
  onAccent: string;
  /** 고정(즐겨찾기) 별. */
  pin: string;
  /** 서비스 상태 점과 칩 배경에 쓰는 색. 상태는 글자 라벨로도 전달되므로 색에만 의존하지 않는다. */
  statusChecking: string;
  statusUp: string;
  statusDown: string;
};

export const LIGHT: Palette = {
  background: '#FFFFFF',
  card: '#F6F7F9',
  text: '#111418',
  subtext: '#5B6470',
  border: '#E1E4E8',
  // 글자로도 쓰이므로 흰 배경에서 4.5:1 이상이 되게 이전(#208AEF, 3.53:1)보다 어둡게 둔다.
  accent: '#0B6BCB',
  onAccent: '#FFFFFF',
  pin: '#B07A00',
  statusChecking: '#6E7781',
  statusUp: '#1A7F37',
  statusDown: '#D1242F',
};

export const DARK: Palette = {
  background: '#0E1013',
  card: '#1A1D22',
  text: '#F2F4F7',
  subtext: '#9AA3AF',
  border: '#2A2F36',
  accent: '#5AA9FF',
  // 밝은 강조색 위에는 어두운 글자를 올려야 대비가 확보된다(흰 글자는 2.46:1).
  onAccent: '#0E1013',
  pin: '#F5B301',
  statusChecking: '#9AA3AF',
  statusUp: '#2DA44E',
  statusDown: '#D1242F',
};
