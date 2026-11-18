import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Android 알림 채널은 한번 만들어지면 앱이 소리·중요도를 바꿀 수 없다.
 * 설정을 바꿀 때는 ID를 올리고(v2, v3…) 이전 채널을 지운다. 발송 측(notify-deployment.yml)의 channelId와 같아야 한다.
 */
export const DEPLOYMENT_CHANNEL = 'deployments-v2';
const LEGACY_CHANNELS = ['deployments'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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
    // 소리 없이 만들어진 이전 채널은 앱이 수정할 수 없으므로 지우고 새 채널을 만든다.
    await Promise.all(
      LEGACY_CHANNELS.map((id) =>
        Notifications.deleteNotificationChannelAsync(id).catch(() => undefined),
      ),
    );
    await Notifications.setNotificationChannelAsync(DEPLOYMENT_CHANNEL, {
      name: '배포 알림',
      importance: AndroidImportance.HIGH,
      sound: 'default',
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
