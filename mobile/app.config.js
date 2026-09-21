/** Expo config — loads Google Maps API key from environment */

function googleIosUrlScheme() {
  if (process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
    return process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  }
  return null;
}

const iosUrlScheme = googleIosUrlScheme();

// Map provider: explicit env override wins. Otherwise default to Google in
// development and MapLibre in production builds.
const mapProvider = (() => {
  const explicit = process.env.EXPO_PUBLIC_MAP_PROVIDER;
  if (explicit === 'google' || explicit === 'maplibre') return explicit;
  return process.env.EAS_BUILD_PROFILE === 'production' ? 'maplibre' : 'google';
})();
// Google Maps SDK key baked into native manifests — only needed when testing
// with EXPO_PUBLIC_MAP_PROVIDER=google.
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const useGoogleMaps = mapProvider === 'google' && !!googleMapsApiKey;

module.exports = {
  expo: {
    name: 'Ufundi',
    slug: 'ufundi',
    version: '1.0.1',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    scheme: 'ufundi',
    icon: './assets/icon.png',
    assetBundlePatterns: ['**/*'],
    runtimeVersion: '1.0.1',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.ufundi.uganda',
      ...(useGoogleMaps
        ? { config: { googleMapsApiKey } }
        : {}),
    },
    android: {
      package: 'com.ufundi.uganda',
      ...(useGoogleMaps
        ? { config: { googleMaps: { apiKey: googleMapsApiKey } } }
        : {}),
      adaptiveIcon: {
        foregroundImage: './assets/splash-icon.png',
        backgroundColor: '#000000',
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      softwareKeyboardLayoutMode: 'resize',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: '*.expo.dev' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Ufundi uses your location to find artisans near you.',
        },
      ],
      'expo-font',
      'expo-web-browser',
      'expo-video',
      '@maplibre/maplibre-react-native',
      // Native Google Sign-In removes the insecure exp:// OAuth callback.
      // iOS needs its own reversed iOS-client scheme when that platform is enabled.
      ...(iosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]]
        : []),
    ],
    extra: {
      eas: {
        projectId: 'b75918f7-f03a-4f72-8367-2c014bec8215',
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
    owner: 'finalyear2026',
    updates: {
      url: 'https://u.expo.dev/b75918f7-f03a-4f72-8367-2c014bec8215',
    },
  },
};
