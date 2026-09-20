import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ScrollScreen from '../components/ScrollScreen';
import AuthHeader from '../components/AuthHeader';
import AuthButton from '../components/AuthButton';
import PhoneInput from '../components/PhoneInput';
import theme from '../theme';
import { getErrorMessage } from '../../services/authApi';
import { isExpoGo, mapGoogleSignInError, useGoogleSignIn } from '../../services/googleSignIn';
import { useLanguage } from '../i18n/LanguageContext';

export default function SignInScreen({
  role = 'client',
  onBack,
  onPhoneOtp,
  onCreateAccount,
  onGoogleEmailOtp,
}) {
  const [phone, setPhone] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const { t } = useLanguage();

  const { signIn, disabled: googleDisabled } = useGoogleSignIn();

  const isFundi = role === 'fundi';

  const handleGoogle = async () => {
    if (isExpoGo) {
      Alert.alert(
        t('Dev build required'),
        t('Google sign-in needs the Ufundi development or release build, not Expo Go.'),
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await signIn();
      if (result?.type === 'success') {
        const idToken = result.data?.idToken;

        if (!idToken) {
          Alert.alert(t('Sign in failed'), t('Could not get Google ID token. Please try again.'));
          return;
        }

        await onGoogleEmailOtp?.({ idToken });
      }
    } catch (error) {
      Alert.alert(
        t('Sign in failed'),
        error?.response ? getErrorMessage(error) : mapGoogleSignInError(error),
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePhoneContinue = async () => {
    if (!phone.trim()) {
      Alert.alert(t('Phone required'), t('Enter your phone number.'));
      return;
    }
    setOtpSending(true);
    try {
      await onPhoneOtp?.({ phone: phone.trim(), role });
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <ScrollScreen keyboard contentStyle={styles.scroll} bottomPad={32}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.black} />

      <AuthHeader
        onBack={onBack}
        title={t('Welcome back')}
        subtitle={
          isFundi
            ? t('Sign in to your fundi dashboard')
            : t('Sign in to find and book trusted fundis')
        }
      />

      <View style={styles.form}>
        <PhoneInput
          value={phone}
          onChangeText={setPhone}
          focused={phoneFocused}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
        />

        {otpSending ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          <AuthButton
            variant="phone"
            label={t('Continue with Phone')}
            onPress={handlePhoneContinue}
          />
        )}
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('or continue with')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <AuthButton
        variant="google"
        label={
          googleDisabled
            ? t('Google (not configured)')
            : isExpoGo
              ? t('Google (dev build only)')
              : t('Google')
        }
        onPress={handleGoogle}
        loading={googleLoading}
        disabled={googleDisabled || isExpoGo}
      />

      <TouchableOpacity onPress={onCreateAccount} style={styles.createRow}>
        <Text style={styles.createText}>
          {t("Don't have an account? ")}<Text style={styles.createLink}>{t('Sign up')}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },

  form: { marginTop: 24 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.mutedDark, fontSize: 12, fontWeight: '600', marginHorizontal: 12 },

  createRow: { marginTop: 20, alignItems: 'center' },
  createText: { color: theme.colors.muted, fontSize: 14 },
  createLink: { color: theme.colors.accent, fontWeight: '700' },
});
