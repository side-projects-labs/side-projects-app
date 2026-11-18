import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

export const DEPLOYMENT_CHANNEL = 'deployments';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type RegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not-device' | 'denied' | 'no-project-id' | 'error' };

/**
 * 권한 요청 후 Expo push 토큰을 발급한다.
 * 토큰은 로그에 남기지 않는다. 서버 등록은 후속(이슈 #2) 범위.
 */
export async function registerForDeploymentPush(): Promise<RegistrationResult> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEPLOYMENT_CHANNEL, {
      name: '배포 알림',
      importance: AndroidImportance.HIGH,
    });
  }
  if (!Device.isDevice) return { ok: false, reason: 'not-device' };

  const current = await Notifications.getPermissionsAsync();
  const status = current.granted
    ? 'granted'
    : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { ok: false, reason: 'denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return { ok: false, reason: 'no-project-id' };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
