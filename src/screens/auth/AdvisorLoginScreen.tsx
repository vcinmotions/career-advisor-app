import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import { useAuthMock } from '../../context/AuthContext';

export default function AdvisorLoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPass, setIsFocusedPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthMock();

  const advisorLoginMutation = useMutation({
    mutationFn: async () => {
      console.log('Attempting advisor login for:', mobileApiClient.defaults.baseURL, email);
      const response = await mobileApiClient.post('/auth/signin', {
        identifier: email.toLowerCase().trim(),
        password,
      });
      return response.data;
    },
    onSuccess: async (resData) => {
      try {
        const { accessToken, refreshToken, user } = resData.data || resData;

        if (!accessToken || !user) throw new Error('The server returned an incomplete login response.');
        if (user.role !== 'CAREER_ADVISOR') throw new Error('This account is not registered as a Career Advisor.');
        await login(user, accessToken, refreshToken || '');

        Alert.alert('Welcome Back', `Logged in successfully as Career Advisor!`);
        navigation.reset({ index: 0, routes: [{ name: 'AppTabs' }] });
      } catch (storeError) {
        console.error('ADVISOR SESSION PERSISTENCE ERROR:', storeError);
        Alert.alert('Login Error', storeError instanceof Error ? storeError.message : 'Failed to save your secure session.');
      }
    },
    onError: (error: any) => {
      const errMsg =
        error?.response?.data?.message ||
        'Invalid advisor email or password credentials.';
      Alert.alert('Advisor Authentication Failed', errMsg);
    },
  });

  const handleAdvisorLoginSubmit = () => {
    if (!email || !password) {
      Alert.alert(
        'Required Fields Missing',
        'Please enter your registered advisor email and password.'
      );
      return;
    }
    advisorLoginMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* NAVBAR HEADER */}
      <View style={styles.navbarHeader}>
        <View style={styles.headerSideSpacer} />
        <Text style={styles.navbarTitleText}>Advisor Portal</Text>
        <TouchableOpacity
          style={styles.settingButtonAction}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.settingActionIconText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.innerLayoutBodyFrame}>
          {/* BRANDING BADGE */}
          <View style={styles.badgeContainer}>
            <Text style={{ fontSize: 14 }}>💼</Text>
            <Text style={styles.badgeLabelText}>CAREER ADVISOR CONSOLE</Text>
          </View>

          <Text style={styles.screenMainTitle}>
            Sign in to your Advisor Console
          </Text>
          <Text style={styles.screenMainSubtext}>
            Enter your credentials to access advisor analytics, student queues, and institutional mapping.
          </Text>

          {/* FORM CARD CONTAINER */}
          <View style={styles.cardSectionBox}>
            {/* EMAIL FIELD */}
            <Text style={styles.inputFieldLabel}>ADVISOR EMAIL ADDRESS</Text>
            <TextInput
              style={[
                styles.textInput,
                isFocusedEmail ? styles.textInputFocused : styles.textInputUnfocused,
              ]}
              placeholder="advisor@domain.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setIsFocusedEmail(true)}
              onBlur={() => setIsFocusedEmail(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!advisorLoginMutation.isPending}
            />

            {/* PASSWORD FIELD WITH TOGGLE */}
            <Text style={styles.inputFieldLabel}>PASSWORD</Text>
            <View
              style={[
                styles.passwordContainerRow,
                isFocusedPass ? styles.textInputFocused : styles.textInputUnfocused,
              ]}
            >
              <TextInput
                style={styles.passwordInputField}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setIsFocusedPass(true)}
                onBlur={() => setIsFocusedPass(false)}
                secureTextEntry={!showPassword}
                editable={!advisorLoginMutation.isPending}
              />
              <TouchableOpacity
                style={styles.eyeIconButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeIconText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN SUBMIT BUTTON */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                advisorLoginMutation.isPending && { opacity: 0.7 },
              ]}
              onPress={handleAdvisorLoginSubmit}
              disabled={advisorLoginMutation.isPending}
            >
              {advisorLoginMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionButtonText}>
                  Log In as Career Advisor →
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* FOOTER LINKS */}
          <View style={styles.footerRedirectGroupWrapper}>
            <View style={styles.flatFooterRedirectGroupRow}>
              <Text style={styles.flatFooterLabelSubtext}>Don't have an advisor account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('AdvisorSignUp')}>
                <Text style={styles.flatFooterActionLinkText}>Register here</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.flatFooterRedirectGroupRow}>
              <Text style={styles.flatFooterLabelSubtext}>Forgot Password? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPasswordScreen')}>
                <Text style={styles.flatFooterActionLinkText}>Reset credentials</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  navbarHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  headerSideSpacer: { width: 40, height: 40 },
  navbarTitleText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  settingButtonAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  settingActionIconText: { fontSize: 18 },

  innerLayoutBodyFrame: { paddingHorizontal: 16, paddingTop: 20, flex: 1 },

  // BRANDING BADGE
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  screenMainTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  screenMainSubtext: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 20, lineHeight: 18 },

  // FORM CARD
  cardSectionBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  inputFieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 4, letterSpacing: 0.3 },
  textInput: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  textInputUnfocused: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  textInputFocused: {
    borderWidth: 2,
    borderColor: '#4F46E5',
  },

  passwordContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  passwordInputField: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  eyeIconButton: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIconText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },

  primaryActionButton: {
    backgroundColor: '#4F46E5',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    borderRadius: 8,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  footerRedirectGroupWrapper: { marginTop: 24, gap: 10 },
  flatFooterRedirectGroupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flatFooterLabelSubtext: { fontSize: 13, color: '#64748B' },
  flatFooterActionLinkText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
});