import { useColorScheme } from 'react-native';

import { DARK, LIGHT, type Palette } from './palette';

// 팔레트 값은 React Native 없이 테스트할 수 있도록 palette.ts에 둔다.
export { DARK, LIGHT, type Palette };

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
