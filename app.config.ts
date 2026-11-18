import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json을 기반으로 하고, FCM용 google-services.json만 EAS 파일 환경변수에서 주입한다.
 * 파일 자체는 저장소에 두지 않는다. (docs/android-release.md 참고)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

  // production 빌드에서 누락되면 푸시가 조용히 동작하지 않으므로 빌드를 실패시킨다.
  if (!googleServicesFile && process.env.EAS_BUILD_PROFILE === 'production') {
    throw new Error('GOOGLE_SERVICES_JSON 환경변수가 없습니다. EAS production 환경에 등록하세요.');
  }

  return {
    ...config,
    name: config.name ?? 'side-projects-app',
    slug: config.slug ?? 'side-projects-app',
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
