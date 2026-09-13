/** Expo config — loads Google Maps API key from environment */

const withAndroidNavigationBarTheme = require('./plugins/withAndroidNavigationBarTheme');

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
    name: 'FundiLink',
    slug: 'fundilink',
    version: '1.0.1',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    scheme: 'fundilink',
    icon: './assets/icon.png',
    assetBundlePatterns: ['**/*'],
    runtimeVersion: '1.0.1',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.fundilink.uganda',
      ...(useGoogleMaps
        ? { config: { googleMapsApiKey } }
        : {}),
    },
    android: {
      package: 'com.fundilink.uganda',
      ...(useGoogleMaps
        ? { config: { googleMaps: { apiKey: googleMapsApiKey } } }
        : {}),
      adaptiveIcon: {
        foregroundImage: './assets/splash-icon.png',
        backgroundColor: '#000000',
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      softwareKeyboardLayoutMode: 'resize',
      // Keep a solid, app-controlled navigation bar in release APKs. Expo SDK 54
      // enables edge-to-edge by default, which can otherwise show the screen
      // beneath the system buttons instead of this configured black bar.
      edgeToEdgeEnabled: false,
      navigationBar: {
        backgroundColor: '#000000',
        barStyle: 'light-content',
      },
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
            'FundiLink uses your location to find artisans near you.',
        },
      ],
      'expo-web-browser',
      'expo-video',
      '@maplibre/maplibre-react-native',
      // Native Google Sign-In removes the insecure exp:// OAuth callback.
      // iOS needs its own reversed iOS-client scheme when that platform is enabled.
      ...(iosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]]
        : []),
      [
        'expo-navigation-bar',
        {
          backgroundColor: '#000000',
          barStyle: 'light-content',
        },
      ],
      './plugins/withAndroidNavigationBarTheme',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#000000',
          image: './assets/splash-icon.png',
          imageWidth: 160,
          resizeMode: 'contain',
          dark: {
            backgroundColor: '#000000',
            image: './assets/splash-icon.png',
          },
        },
      ],
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
