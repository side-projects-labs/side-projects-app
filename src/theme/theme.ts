import { useColorScheme } from 'react-native';

export type Palette = {
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
};

export const LIGHT: Palette = {
  background: '#FFFFFF',
  card: '#F6F7F9',
  text: '#111418',
  subtext: '#5B6470',
  border: '#E1E4E8',
  accent: '#208AEF',
};

export const DARK: Palette = {
  background: '#0E1013',
  card: '#1A1D22',
  text: '#F2F4F7',
  subtext: '#9AA3AF',
  border: '#2A2F36',
  accent: '#5AA9FF',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
