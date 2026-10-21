import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import { useAuthMock } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface WidgetCardProps {
  title: string;
  value: string | number;
  sub: string;
  iconName: keyof typeof Ionicons.glyphMap;
  highlight?: boolean;
  success?: boolean;
}

function WidgetCard({ title, value, sub, iconName, highlight, success }: WidgetCardProps) {
  return (
    <View style={[styles.widgetCard, highlight && styles.widgetCardHighlight]}>
      <View style={styles.widgetHeaderRow}>
        <Text style={styles.widgetTitleText}>{title}</Text>
        <Ionicons
          name={iconName}
          size={18}
          color={success ? '#047857' : highlight ? '#4F46E5' : '#64748B'}
        />
      </View>
      <Text style={[styles.widgetValueText, success && styles.widgetSuccessText]}>
        {value}
      </Text>
      <Text style={styles.widgetSubtext}>{sub}</Text>
    </View>
  );
}

function ProgressRow({ label, isComplete }: { label: string; isComplete?: boolean }) {
  return (
    <View style={styles.progressRowContainer}>
      <View style={styles.progressRowLeft}>
        <Ionicons
          name={isComplete ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={isComplete ? '#047857' : '#94A3B8'}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.progressRowLabel}>{label}</Text>
      </View>
      <View style={[styles.statusBadgePill, isComplete ? styles.statusBadgeSuccess : styles.statusBadgePending]}>
        <Text style={[styles.statusBadgeText, isComplete ? styles.statusBadgeTextSuccess : styles.statusBadgeTextPending]}>
          {isComplete ? 'COMPLETED' : 'IN PROGRESS'}
        </Text>
      </View>
    </View>
  );
}

export default function AdvisorDashboardScreen({ navigation }: any) {
  const { user } = useAuthMock();

  // Query for LMS Advisor Overview & Metrics
  const overviewQuery = useQuery({
    queryKey: ['ca-dashboard-overview', user?.id],
    queryFn: async () => (await mobileApiClient.get('/lms/me/overview')).data?.data,
    enabled: Boolean(user?.id),
  });

  // Query for Dashboard Metrics
  const metricsQuery = useQuery({
    queryKey: ['ca-dashboard-metrics', user?.id],
    queryFn: async () => (await mobileApiClient.get('/dashboard/metrics')).data?.data,
    enabled: Boolean(user?.id),
  });

  const isLoading = overviewQuery.isLoading || metricsQuery.isLoading;
  const isFetching = overviewQuery.isFetching || metricsQuery.isFetching;

  const handleRefresh = () => {
    overviewQuery.refetch();
    metricsQuery.refetch();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingCenterContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Syncing Counsellor Workspace...</Text>
      </SafeAreaView>
    );
  }

  const overviewData = overviewQuery.data || {};
  const metricsData = metricsQuery.data || {};
  const widgets = metricsData.widgets || {};

  const stages = overviewData.stages || [];
  const myLeads = widgets.myLeads ?? widgets.totalStudents ?? 0;
  const admissions = widgets.admissionsGenerated ?? widgets.totalAdmissions ?? 0;
  const target = widgets.targetObjective ?? 45;
  const redeemedCoupons = widgets.redeemedCoupons ?? overviewData.couponSelling?.redeemed ?? 0;
  const allocatedCoupons = widgets.allocatedCoupons ?? overviewData.couponSelling?.required ?? 0;

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.name || user?.email || 'Advisor';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.mainScrollView}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={handleRefresh} colors={['#4F46E5']} />}
      >
        {/* ─── HERO PUBLICATION BANNER ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBanner}>
            <View style={styles.heroDecorationRight} />
            <View style={styles.heroDecorationLeft} />

            <View style={styles.zIndexHigh}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>💼 COUNSELLOR WORKSPACE</Text>
              </View>
              <Text style={styles.heroTitle}>Welcome back, {displayName}</Text>
              <Text style={styles.heroSubtitle}>
                Candidate acquisition and counselling ledger console.
              </Text>
              <TouchableOpacity
                style={styles.heroButton}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdvisorSignUp')}
              >
                <Text style={styles.heroButtonText}>+ Register Candidate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── VALUE MATRIX TRUST BAR ─── */}
        <View style={styles.trustSection}>
          <View style={styles.trustBar}>
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>🛡️</Text>
              <Text style={styles.trustText}>Active Node</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>💎</Text>
              <Text style={styles.trustText}>Full Support</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>📜</Text>
              <Text style={styles.trustText}>ISO Certified</Text>
            </View>
          </View>
        </View>

        {/* ─── METRICS WIDGET GRID (4 CARDS) ─── */}
        <View style={styles.coursesSection}>
          <Text style={styles.sectionHeadingText}>Performance Metrics</Text>
          <View style={styles.widgetGrid}>
            <WidgetCard
              title="ALLOCATED LEADS"
              value={myLeads}
              sub="Active candidates under follow-up"
              iconName="people-outline"
            />
            <WidgetCard
              title="CONVERTED ADMISSIONS"
              value={admissions}
              sub="Students moved to admission"
              iconName="checkmark-done-circle-outline"
              success
            />
            <WidgetCard
              title="MONTHLY TARGET"
              value={`${admissions} / ${target}`}
              sub="Admission performance vs goal"
              iconName="trophy-outline"
              highlight
            />
            <WidgetCard
              title="COUPON REDEMPTIONS"
              value={redeemedCoupons}
              sub={`${allocatedCoupons} allocated to you`}
              iconName="pricetag-outline"
            />
          </View>
        </View>

        {/* ─── ACCOUNT OVERVIEW CARD ─── */}
        <View style={styles.contentFeedSection}>
          <Text style={styles.sectionHeadingTextNoPadding}>Advisor Account Overview</Text>
          <View style={styles.premiumCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Registered Email</Text>
              <Text style={styles.infoRowValue}>{user?.email || '—'}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoRowLabel}>Account Status</Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{overviewData.status || 'ACTIVE'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── ONBOARDING PROGRESS ─── */}
        <View style={styles.contentFeedSection}>
          <Text style={styles.sectionHeadingTextNoPadding}>Onboarding Stage Progress</Text>
          <View style={styles.premiumCard}>
            {stages.length === 0 ? (
              <Text style={styles.emptyStateText}>No milestone stages active.</Text>
            ) : (
              stages.map((stage: any) => (
                <ProgressRow
                  key={stage.key}
                  label={String(stage.key).replace(/_/g, ' ')}
                  isComplete={stage.complete}
                />
              ))
            )}

            <ProgressRow
              label="Coupon Sales Objective"
              isComplete={overviewData.couponSelling?.complete}
            />
          </View>

          {/* PRIMARY ACTION BUTTON */}
          <TouchableOpacity
            style={styles.solidPrimaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdvisorOrientation')}
          >
            <Text style={styles.solidPrimaryButtonText}>Open CA Onboarding Journey →</Text>
          </TouchableOpacity>
        </View>

        {/* ─── FOOTER PLATFORM CTA BANNER ─── */}
        <View style={styles.ctaSection}>
          <View style={styles.ctaBanner}>
            <View style={styles.ctaDecorationCircle} />
            <Text style={styles.ctaTitle}>Counsellor Sandbox Node</Text>
            <Text style={styles.ctaDescription}>
              Draft candidate enrollments, track coupon settlements, and manage institutional mapping directly.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdvisorOrientation')}
            >
              <Text style={styles.ctaButtonText}>Review Onboarding Modules</Text>
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

  // HERO BANNER MODULES
  heroSection: { paddingVertical: 16, backgroundColor: '#FFFFFF' },
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
  heroSubtitle: { color: 'rgba(199, 210, 254, 0.8)', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  heroButton: { backgroundColor: '#10B981', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  heroButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // VALUE TRUST RIBBON
  trustSection: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#FFFFFF' },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12 },
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trustEmoji: { fontSize: 13, marginRight: 6 },
  trustText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  trustDivider: { width: 1, backgroundColor: '#E2E8F0', height: 14, alignSelf: 'center' },

  // TYPOGRAPHY GRIDS & SECTIONS
  sectionHeadingText: { fontSize: 15, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12, letterSpacing: -0.3 },
  sectionHeadingTextNoPadding: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12, letterSpacing: -0.3 },
  coursesSection: { paddingVertical: 16, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  contentFeedSection: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },

  // WIDGET GRID
  widgetGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  widgetCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  widgetCardHighlight: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  widgetTitleText: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.4, flex: 1 },
  widgetValueText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  widgetSuccessText: { color: '#047857' },
  widgetSubtext: { fontSize: 10, color: '#94A3B8', marginTop: 4 },

  // PREMIUM CARDS & INFO ROWS
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  infoRowValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  activePill: { backgroundColor: '#ECFDF5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText: { fontSize: 10, fontWeight: '800', color: '#047857' },

  // PROGRESS ROWS
  progressRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  progressRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressRowLabel: { fontSize: 12, fontWeight: '600', color: '#0F172A', textTransform: 'capitalize' },
  statusBadgePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeSuccess: { backgroundColor: '#ECFDF5' },
  statusBadgePending: { backgroundColor: '#EEF2FF' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  statusBadgeTextSuccess: { color: '#047857' },
  statusBadgeTextPending: { color: '#4F46E5' },
  emptyStateText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },

  // BUTTON
  solidPrimaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidPrimaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // FOOTER CTA BANNER
  ctaSection: { paddingVertical: 24, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  ctaBanner: { marginHorizontal: 20, backgroundColor: '#4F46E5', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  ctaDecorationCircle: { position: 'absolute', right: -20, bottom: -20, width: 96, height: 96, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 48 },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  ctaDescription: { color: '#E0E7FF', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  ctaButton: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctaButtonText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
});