import Constants from 'expo-constants';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Expo Go cannot load the native Google Sign-In module — Google Sign-In
// requires a development or release build (expo run:android / EAS).
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Load the native module lazily. A top-level import evaluates the native
// TurboModule at module-load time and throws inside Expo Go, crashing the
// whole app on boot. Guarded require keeps Expo Go usable for everything
// that isn't Google Sign-In.
let GoogleSignin = null;
try {
  if (!isExpoGo) {
    ({ GoogleSignin } = require('@react-native-google-signin/google-signin'));
  }
} catch (_) {
  GoogleSignin = null;
}

// Native Google Sign-In is deliberately used instead of expo-auth-session.
// Google rejects Expo Go's exp:// LAN callback as an insecure redirect URI.
// Configure once at module load; Android identifies the app through its package
// name and signing SHA-1 registered in Google Cloud, not a redirect URI.
if (webClientId && !isExpoGo && GoogleSignin) {
  GoogleSignin.configure({
    webClientId,
    scopes: ['profile', 'email'],
  });
}

export function useGoogleSignIn() {
  const disabled = !webClientId;

  const signIn = async () => {
    if (disabled) {
      throw new Error(
        'Google sign-in is not configured. Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
      );
    }

    if (typeof GoogleSignin?.signIn !== 'function') {
      throw new Error(
        'The native Google Sign-In module is not present in this build. Close the app and reinstall a fresh development or release build.'
      );
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    return GoogleSignin.signIn();
  };

  return { signIn, disabled };
}

export function mapGoogleSignInError(error) {
  const message = error?.message || '';
  const code = error?.code;

  if (message.includes('signIn is not a function')) {
    return 'This copy of the app is out of date. Fully close it and reinstall the latest build.';
  }
  if (
    code === '10' ||
    message.includes('DEVELOPER_ERROR') ||
    message.includes('The caller is not authorized') ||
    message.includes('developer console')
  ) {
    return 'This build is not registered for Google Sign-In. Add an Android OAuth client in Google Cloud Console with package com.ufundi.uganda and the SHA-1 of the signing certificate this APK was built with (see mobile/.env.example), then rebuild.';
  }
  if (message.includes('Native module')) {
    return 'Google sign-in needs the Ufundi development or release build. It does not run in Expo Go.';
  }
  if (message.includes('No matching browser activity found')) {
    return 'Google sign-in requires a browser app. Please install Chrome or another browser and try again.';
  }
  if (
    message.includes('cancelled') ||
    message.includes('CANCELLED') ||
    message.includes('SIGN_IN_CANCELLED')
  ) {
    return 'Sign-in was cancelled.';
  }
  if (message.includes('SIGN_IN_REQUIRED')) {
    return 'Sign in to a Google account on this device first, then try again.';
  }
  if (message.includes('INTERNAL_ERROR')) {
    return 'Google could not complete sign-in. Try again, or restart the app.';
  }
  return message || 'Google sign-in failed.';
}
