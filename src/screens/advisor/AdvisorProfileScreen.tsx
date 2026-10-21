import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import { useAuthMock } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function AdvisorProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthMock();

  const query = useQuery({
    queryKey: ['ca-profile'],
    queryFn: async () => (await mobileApiClient.get('/profile')).data?.data,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.loadingCenterContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Syncing Profile Node...</Text>
      </SafeAreaView>
    );
  }

  const profile = query.data || {};
  const fullName = `${profile.firstName || user?.firstName || ''} ${profile.lastName || user?.lastName || ''}`.trim() || user?.name || 'Career Advisor';
  const displayEmail = profile.email || user?.email || '—';
  const displayPhone = profile.phone || user?.phone || '—';
  const displayRole = (profile.role || user?.role || 'CAREER_ADVISOR').replace(/_/g, ' ');

  const initialLetter = fullName.charAt(0).toUpperCase() || 'A';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HEADER BAR ─── */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>CA Profile Console</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.mainScrollView}>
        {/* ─── HERO PUBLICATION BANNER ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBanner}>
            <View style={styles.heroDecorationRight} />
            <View style={styles.heroDecorationLeft} />

            <View style={styles.zIndexHigh}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>👤 OFFICIAL ADVISOR ACCOUNT</Text>
              </View>
              <Text style={styles.heroTitle}>Counsellor Profile</Text>
              <Text style={styles.heroSubtitle}>
                Smart Skills credentials and official account parameter ledger.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── PROFILE HERO CARD ─── */}
        <View style={styles.contentFeedSection}>
          <View style={styles.profileHeroCard}>
            <View style={styles.avatarPlaceholderPill}>
              <Text style={styles.avatarTextLabel}>{initialLetter}</Text>
            </View>
            <Text style={styles.profileNameText}>{fullName}</Text>
            <Text style={styles.profileEmailText}>{displayEmail}</Text>
            <View style={styles.roleBadgeFrame}>
              <Text style={styles.roleBadgeText}>{displayRole.toUpperCase()}</Text>
            </View>
          </View>

          {/* ─── ACCOUNT PARAMETERS SECTION ─── */}
          <View style={styles.settingsActionSectionGroup}>
            <Text style={styles.sectionHeaderLabel}>Account Parameters</Text>

            <View style={styles.actionItemRowButton}>
              <Text style={styles.actionItemLabelText}>Full Name</Text>
              <Text style={styles.actionItemValueText}>{fullName}</Text>
            </View>

            <View style={styles.actionItemRowButton}>
              <Text style={styles.actionItemLabelText}>Mobile Phone</Text>
              <Text style={styles.actionItemValueText}>{displayPhone}</Text>
            </View>

            <View style={styles.actionItemRowButton}>
              <Text style={styles.actionItemLabelText}>Registered Email</Text>
              <Text style={styles.actionItemValueText}>{displayEmail}</Text>
            </View>

            <View style={styles.actionItemRowButton}>
              <Text style={styles.actionItemLabelText}>Assigned System Role</Text>
              <Text style={styles.actionItemValueText}>{displayRole}</Text>
            </View>
          </View>

          {/* ─── LEGAL & DOCUMENTATION SECTION ─── */}
          <View style={styles.settingsActionSectionGroup}>
            <Text style={styles.sectionHeaderLabel}>Legal & Documentation</Text>

            <TouchableOpacity
              style={styles.actionItemRowTouch}
              onPress={() => navigation.navigate('CompanyInfo')}
            >
              <Text style={styles.actionItemButtonTextText}>Company Info</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItemRowTouch}
              onPress={() => navigation.navigate('AboutUs')}
            >
              <Text style={styles.actionItemButtonTextText}>About Smart Skills India</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItemRowTouch}
              onPress={() => navigation.navigate('TermsOfUse')}
            >
              <Text style={styles.actionItemButtonTextText}>Terms Of Use</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItemRowTouch}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <Text style={styles.actionItemButtonTextText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* ─── LOGOUT BUTTON ─── */}
          <TouchableOpacity
            style={styles.logoutSystemActionActionButton}
            activeOpacity={0.8}
            onPress={async () => {
              await logout();
            }}
          >
            <Text style={styles.logoutSystemActionActionButtonText}>Sign Out Account</Text>
          </TouchableOpacity>
        </View>

        {/* ─── FOOTER CTA BANNER ─── */}
        <View style={styles.ctaSection}>
          <View style={styles.ctaBanner}>
            <View style={styles.ctaDecorationCircle} />
            <Text style={styles.ctaTitle}>Smart Skills Support</Text>
            <Text style={styles.ctaDescription}>
              Profile details are managed by central administration. Contact support to update official records.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.ctaButtonText}>Contact Support Console</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // CORE BACKGROUND CONTEXTS
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  mainScrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 10 },

  // HEADER BAR
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },

  // HERO BANNER MODULES
  heroSection: { paddingVertical: 12, backgroundColor: '#FFFFFF' },
  heroBanner: {
    marginHorizontal: 20,
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorationRight: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 80,
  },
  heroDecorationLeft: {
    position: 'absolute',
    left: -40,
    bottom: -40,
    width: 128,
    height: 128,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 64,
  },
  zIndexHigh: { zIndex: 10 },
  heroBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.3)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  heroBadgeText: { color: '#C7D2FE', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 26, marginBottom: 6, letterSpacing: -0.5 },
  heroSubtitle: { color: 'rgba(199, 210, 254, 0.8)', fontSize: 12, lineHeight: 18 },

  // VALUE TRUST RIBBON
  trustSection: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12 },
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trustEmoji: { fontSize: 13, marginRight: 6 },
  trustText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  trustDivider: { width: 1, backgroundColor: '#E2E8F0', height: 14, alignSelf: 'center' },

  // CONTENT FEED
  contentFeedSection: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF' },

  // PROFILE HERO CARD
  profileHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  avatarPlaceholderPill: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLabel: { fontSize: 24, fontWeight: '800', color: '#4F46E5' },
  profileNameText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  profileEmailText: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 12 },
  roleBadgeFrame: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#EEF2FF' },
  roleBadgeText: { fontSize: 10, fontWeight: '800', color: '#4F46E5', letterSpacing: 0.5 },

  // SETTINGS ACTION GROUPS
  settingsActionSectionGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    letterSpacing: 0.5,
  },
  actionItemRowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionItemRowTouch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionItemLabelText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  actionItemValueText: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  actionItemButtonTextText: { fontSize: 13, color: '#334155', fontWeight: '600' },

  // LOGOUT BUTTON
  logoutSystemActionActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutSystemActionActionButtonText: { color: '#EF4444', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },

  // FOOTER CTA BANNER
  ctaSection: { paddingVertical: 24, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  ctaBanner: { marginHorizontal: 20, backgroundColor: '#4F46E5', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  ctaDecorationCircle: { position: 'absolute', right: -20, bottom: -20, width: 96, height: 96, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 48 },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  ctaDescription: { color: '#E0E7FF', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  ctaButton: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctaButtonText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
});