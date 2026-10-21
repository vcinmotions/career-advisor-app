import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import AdvisorLmsVideoPlayer from './AdvisorLmsVideoPlayer';
import { Ionicons } from '@expo/vector-icons';

type StageKey =
  | 'ORIENTATION'
  | 'TRAINING'
  | 'MCQ_ASSESSMENT'
  | 'INTERNSHIP'
  | 'AGREEMENT'
  | 'CERTIFICATION'
  | 'ACTIVATION';

interface StageMeta {
  key: StageKey;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  path: string;
}

const STAGE_META: StageMeta[] = [
  { key: 'ORIENTATION', label: 'Orientation', iconName: 'videocam-outline', path: '/lms/me/orientation/overview' },
  { key: 'TRAINING', label: 'Training', iconName: 'book-outline', path: '/lms/me/training/overview' },
  { key: 'MCQ_ASSESSMENT', label: 'Assessment', iconName: 'help-circle-outline', path: '/lms/me/assessment' },
  { key: 'INTERNSHIP', label: 'Internship', iconName: 'briefcase-outline', path: '/lms/me/overview' },
  { key: 'AGREEMENT', label: 'Agreement', iconName: 'document-text-outline', path: '/lms/me/agreement' },
  { key: 'CERTIFICATION', label: 'Certification', iconName: 'ribbon-outline', path: '/lms/me/overview' },
  { key: 'ACTIVATION', label: 'Activation', iconName: 'sparkles-outline', path: '/lms/me/overview' },
];

export default function AdvisorLifecycleScreen({ route, navigation }: any) {
  const [activeStageKey, setActiveStageKey] = useState<StageKey>('ORIENTATION');

  useEffect(() => {
    if (route.name === 'AdvisorTraining') setActiveStageKey('TRAINING');
    else if (route.name === 'AdvisorMcq') setActiveStageKey('MCQ_ASSESSMENT');
    else if (route.name === 'AdvisorInternship') setActiveStageKey('INTERNSHIP');
    else if (route.name === 'AdvisorAgreement') setActiveStageKey('AGREEMENT');
    else if (route.name === 'AdvisorCertification') setActiveStageKey('CERTIFICATION');
    else setActiveStageKey('ORIENTATION');
  }, [route.name]);

  const activeStageConfig = useMemo(
    () => STAGE_META.find((s) => s.key === activeStageKey) || STAGE_META[0],
    [activeStageKey]
  );

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [activeVideo, setActiveVideo] = useState<any>(null);
  const [agreementChecks, setAgreementChecks] = useState({ terms: false, privacy: false, conduct: false });

  // Main Stage Query
  const query = useQuery({
    queryKey: ['ca-lifecycle', activeStageConfig.path],
    queryFn: async () => (await mobileApiClient.get(activeStageConfig.path)).data?.data,
  });

  // Overview Query
  const overviewQuery = useQuery({
    queryKey: ['ca-overview-lifecycle'],
    queryFn: async () => (await mobileApiClient.get('/lms/me/overview')).data?.data,
  });

  const overviewData = overviewQuery.data || {};
  const completedKeys = useMemo(
    () => new Set((overviewData.stages || []).filter((s: any) => s.complete).map((s: any) => s.key)),
    [overviewData]
  );

  const questions = useMemo(() => query.data?.questions || [], [query.data]);
  const refreshLms = useCallback(() => {
    void query.refetch();
    void overviewQuery.refetch();
  }, [query, overviewQuery]);

  // Mutations
  const completeModule = useMutation({
    mutationFn: (moduleId: string) => mobileApiClient.post(`/lms/me/training/modules/${moduleId}/complete`, {}),
    onSuccess: () => {
      refreshLms();
      Alert.alert('Module Complete', 'Training module status updated successfully.');
    },
    onError: (error: any) =>
      Alert.alert('Action Failed', error?.response?.data?.message || 'Watch required video or material first.'),
  });

  const requestCertification = useMutation({
    mutationFn: () => mobileApiClient.post('/career-advisors/me/certify-after-coupon-target', {}),
    onSuccess: () => {
      Alert.alert('Certification Requested', 'Smart Skills recorded your certification request.');
      refreshLms();
    },
    onError: (error: any) =>
      Alert.alert('Unavailable', error?.response?.data?.message || 'Complete onboarding and coupon sales target first.'),
  });

  const acceptAgreement = useMutation({
    mutationFn: async () => {
      const agreementId = query.data?.id || query.data?.agreementId || query.data?.agreement?.id;
      if (!agreementId || !agreementChecks.terms || !agreementChecks.privacy || !agreementChecks.conduct) {
        throw new Error('Please review and accept all three agreement declarations.');
      }
      return mobileApiClient.post('/lms/me/agreement/accept', {
        agreementId,
        acceptedTerms: agreementChecks.terms,
        acceptedPrivacy: agreementChecks.privacy,
        acceptedCodeOfConduct: agreementChecks.conduct,
        method: 'DIGITAL_SIGNATURE',
      });
    },
    onSuccess: () => {
      Alert.alert('Agreement Signed', 'Smart Skills recorded your digital signature.');
      refreshLms();
    },
    onError: (error: any) => Alert.alert('Agreement Error', error?.response?.data?.message || 'Could not accept agreement.'),
  });

  const submitMcq = useMutation({
    mutationFn: async () => {
      if (!questions.length || questions.some((entry: any) => !answers[(entry.question || entry).id]?.length)) {
        throw new Error('Please answer every question before submitting.');
      }
      const payload = Object.entries(answers).map(([questionId, optionIds]) => ({
        questionId,
        selectedOptionIds: optionIds,
      }));
      return mobileApiClient.post('/lms/me/assessment/submit', { answers: payload });
    },
    onSuccess: (response) => {
      const result = response.data?.data;
      Alert.alert(
        'Exam Result',
        `${result?.passed ? 'PASSED 🎉' : 'NOT PASSED'} — ${result?.percentage ?? 0}% (${result?.correct ?? 0}/${result?.total ?? 0}).`
      );
      refreshLms();
    },
    onError: (error: any) => Alert.alert('Exam Error', error?.response?.data?.message || 'Could not submit exam.'),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.loadingCenterContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Syncing onboarding matrices...</Text>
      </SafeAreaView>
    );
  }

  const data = query.data || {};

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.mainScrollView}>
        {/* ─── HERO PUBLICATION BANNER ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBanner}>
            <View style={styles.heroDecorationRight} />
            <View style={styles.heroDecorationLeft} />

            <View style={styles.zIndexHigh}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>⚡ Career Advisor Onboarding</Text>
              </View>
              <Text style={styles.heroTitle}>Counsellor Lifecycle Node</Text>
              <Text style={styles.heroSubtitle}>
                Complete all mandatory milestones to activate your official counselling console.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── HORIZONTAL STEPPER NAVIGATION TAG BAR ─── */}
        <View style={styles.categoryFilterSection}>
          <Text style={styles.sectionHeadingText}>Onboarding Milestones</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContainer}
          >
            {STAGE_META.map((stage) => {
              const isComplete = completedKeys.has(stage.key as any);
              const isActive = stage.key === activeStageKey;

              return (
                <TouchableOpacity
                  key={stage.key}
                  onPress={() => setActiveStageKey(stage.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.categoryTab,
                    isActive
                      ? styles.categoryTabActive
                      : isComplete
                      ? styles.categoryTabComplete
                      : styles.categoryTabInactive,
                  ]}
                >
                  <Ionicons
                    name={isComplete ? 'checkmark-circle' : stage.iconName}
                    size={16}
                    color={isActive ? '#FFFFFF' : isComplete ? '#047857' : '#475569'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.categoryTabText,
                      isActive
                        ? styles.textWhite
                        : isComplete
                        ? styles.textEmerald
                        : styles.textSlate700,
                    ]}
                  >
                    {stage.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── DYNAMIC STAGE CONTENT FEED ─── */}
        <View style={styles.contentFeedSection}>
          {/* STAGE 1: ORIENTATION */}
          {activeStageKey === 'ORIENTATION' && (
            <View>
              <View style={styles.stageHeaderBlock}>
                <Text style={styles.sectionHeadingTextNoPadding}>Stage 1: Orientation Videos</Text>
                <Text style={styles.stageSubtitleText}>
                  Completed: {data.completedVideos ?? 0} of {data.totalVideos ?? 0} videos. Watch each video to 90% to unlock next tracks.
                </Text>
              </View>

              {(data.videos || data.items || []).map((item: any, index: number) => {
                const video = item.video || item;
                const completed = item.progress?.isCompleted || item.isCompleted;
                const videoId = item.videoAssetId || video.videoAssetId || video.id;

                return (
                  <TouchableOpacity
                    key={item.id || video.id || index}
                    activeOpacity={0.8}
                    style={[styles.premiumCard, item.isLocked && styles.cardLockedOpacity]}
                    disabled={item.isLocked || !video.url}
                    onPress={() =>
                      setActiveVideo({
                        kind: 'orientation',
                        videoId,
                        title: video.title || item.title,
                        url: video.url,
                      })
                    }
                  >
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitleText}>
                        {video.title || item.title || 'Orientation Video'}
                      </Text>
                      {completed ? (
                        <View style={styles.badgeSuccess}>
                          <Text style={styles.badgeSuccessText}>COMPLETED</Text>
                        </View>
                      ) : item.isLocked ? (
                        <View style={styles.badgeLocked}>
                          <Text style={styles.badgeLockedText}>LOCKED</Text>
                        </View>
                      ) : (
                        <View style={styles.badgePrimary}>
                          <Text style={styles.badgePrimaryText}>TAP TO WATCH ▶</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardBodyText}>
                      {item.isLocked
                        ? 'Complete previous videos to unlock this blueprint.'
                        : completed
                        ? 'Watch requirement fully satisfied.'
                        : 'Tap to launch orientation stream in video player.'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STAGE 2: TRAINING */}
          {activeStageKey === 'TRAINING' && (
            <View>
              <View style={styles.stageHeaderBlock}>
                <Text style={styles.sectionHeadingTextNoPadding}>Stage 2: Training Modules</Text>
                <Text style={styles.stageSubtitleText}>
                  Completed: {data.completedModules || 0} of {data.totalModules || 0} modules.
                </Text>
              </View>

              {(data.modules || data.withProgress || []).map((item: any) => (
                <View key={item.id} style={styles.premiumCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitleText}>{item.title}</Text>
                    {item.isCompleted ? (
                      <View style={styles.badgeSuccess}>
                        <Text style={styles.badgeSuccessText}>COMPLETED</Text>
                      </View>
                    ) : item.isLocked ? (
                      <View style={styles.badgeLocked}>
                        <Text style={styles.badgeLockedText}>LOCKED</Text>
                      </View>
                    ) : (
                      <View style={styles.badgePrimary}>
                        <Text style={styles.badgePrimaryText}>PENDING</Text>
                      </View>
                    )}
                  </View>

                  {item.description && <Text style={styles.cardBodyText}>{item.description}</Text>}

                  {!item.isLocked && !item.isCompleted && (
                    <View style={styles.actionButtonGroup}>
                      {!!item.videoUrl && !!item.videoAssetId && (
                        <TouchableOpacity
                          style={styles.outlineActionButton}
                          activeOpacity={0.8}
                          onPress={() =>
                            setActiveVideo({
                              kind: 'training',
                              videoId: item.videoAssetId,
                              moduleId: item.id,
                              title: item.title,
                              url: item.videoUrl,
                            })
                          }
                        >
                          <Ionicons name="play-circle-outline" size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                          <Text style={styles.outlineActionText}>Watch Training Video</Text>
                        </TouchableOpacity>
                      )}

                      {!!item.pdfUrl && (
                        <TouchableOpacity
                          style={styles.outlineActionButton}
                          activeOpacity={0.8}
                          onPress={() => Linking.openURL(item.pdfUrl)}
                        >
                          <Ionicons name="document-text-outline" size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                          <Text style={styles.outlineActionText}>Open PDF Material</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.solidPrimaryButton}
                        activeOpacity={0.8}
                        disabled={completeModule.isPending}
                        onPress={() => completeModule.mutate(item.id)}
                      >
                        <Text style={styles.solidPrimaryButtonText}>Mark Module Complete ✓</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* STAGE 3: MCQ ASSESSMENT */}
          {activeStageKey === 'MCQ_ASSESSMENT' && (
            <View>
              <View style={styles.stageHeaderBlock}>
                <Text style={styles.sectionHeadingTextNoPadding}>Stage 3: Assessment Examination</Text>
                <Text style={styles.stageSubtitleText}>
                  Answer all questions accurately to pass evaluation and advance to field internship.
                </Text>
              </View>

              {questions.map((entry: any, idx: number) => {
                const question = entry.question || entry;
                const selectedAnswers = answers[question.id] || [];

                return (
                  <View key={question.id} style={styles.premiumCard}>
                    <Text style={styles.questionTitleText}>
                      <Text style={{ color: '#4F46E5' }}>Q{idx + 1}. </Text>
                      {question.questionText || question.prompt || question.question || question.text}
                    </Text>

                    <View style={styles.mcqOptionsList}>
                      {(question.options || []).map((option: any) => {
                        const isSelected = selectedAnswers.includes(option.id);

                        return (
                          <TouchableOpacity
                            key={option.id}
                            activeOpacity={0.8}
                            style={[styles.mcqOptionItem, isSelected && styles.mcqOptionItemSelected]}
                            onPress={() =>
                              setAnswers((current) => {
                                const selected = current[question.id] || [];
                                const next =
                                  question.type === 'MULTIPLE_CORRECT'
                                    ? selected.includes(option.id)
                                      ? selected.filter((id) => id !== option.id)
                                      : [...selected, option.id]
                                    : [option.id];
                                return { ...current, [question.id]: next };
                              })
                            }
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? '#4F46E5' : '#94A3B8'}
                              style={{ marginRight: 8 }}
                            />
                            <Text style={[styles.mcqOptionText, isSelected && styles.mcqOptionTextSelected]}>
                              {option.optionText || option.text || option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.solidPrimaryButton}
                activeOpacity={0.8}
                onPress={() => submitMcq.mutate()}
                disabled={submitMcq.isPending || questions.length === 0}
              >
                {submitMcq.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.solidPrimaryButtonText}>Submit Assessment Answers →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STAGE 4: INTERNSHIP */}
          {activeStageKey === 'INTERNSHIP' && (
            <View style={styles.premiumCard}>
              <Text style={styles.cardTitleText}>
                {data.learningPath?.internshipAssignment?.program?.title || 'Field Internship Assignment'}
              </Text>
              <View style={styles.inlineStatusRow}>
                <Text style={styles.cardBodyText}>Status: </Text>
                <View style={styles.badgePrimary}>
                  <Text style={styles.badgePrimaryText}>
                    {data.learningPath?.internshipAssignment?.status || 'NOT ASSIGNED YET'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardBodyTextMargin}>
                Orientation, training, and assessment must be completed first. Your mapped Institute Admin will initialize and close this stage.
              </Text>
            </View>
          )}

          {/* STAGE 5: AGREEMENT */}
          {activeStageKey === 'AGREEMENT' && (
            <View>
              <View style={styles.premiumCard}>
                <Text style={styles.cardTitleText}>
                  {data.agreement?.title || 'Smart Skills Digital Agreement'}
                </Text>
                <Text style={styles.cardBodyText}>
                  Status: {data.signature ? 'SIGNED & ACCEPTED' : 'PENDING DIGITAL SIGNATURE'}
                </Text>

                {!!data.agreement?.bodyHtml && (
                  <ScrollView style={styles.agreementBodyScrollView} nestedScrollEnabled>
                    <Text style={styles.agreementBodyText}>
                      {String(data.agreement.bodyHtml)
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/\s+/g, ' ')
                        .trim()}
                    </Text>
                  </ScrollView>
                )}
              </View>

              <View style={styles.premiumCard}>
                {[
                  ['terms', 'I accept the Terms of Engagement.'],
                  ['privacy', 'I acknowledge the Privacy Policy.'],
                  ['conduct', 'I agree to strictly adhere to the Code of Conduct.'],
                ].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.8}
                    style={styles.checkboxTouchRow}
                    disabled={!!data.signature}
                    onPress={() =>
                      setAgreementChecks((current: any) => ({ ...current, [key]: !current[key] }))
                    }
                  >
                    <Ionicons
                      name={(agreementChecks as any)[key] ? 'checkbox' : 'square-outline'}
                      size={20}
                      color="#4F46E5"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.checkboxLabelText}>{label}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.solidPrimaryButton, { marginTop: 16 }]}
                  activeOpacity={0.8}
                  onPress={() => acceptAgreement.mutate()}
                  disabled={
                    acceptAgreement.isPending ||
                    !!data.signature ||
                    !agreementChecks.terms ||
                    !agreementChecks.privacy ||
                    !agreementChecks.conduct
                  }
                >
                  {acceptAgreement.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.solidPrimaryButtonText}>
                      {data.signature ? 'Agreement Already Signed ✓' : 'Accept & Digitally Sign'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STAGE 6: CERTIFICATION */}
          {activeStageKey === 'CERTIFICATION' && (
            <View style={styles.premiumCard}>
              <Text style={styles.cardTitleText}>
                {data.learningPath?.certificate?.certificateNumber ? 'Certified Advisor' : 'Certification Eligibility'}
              </Text>
              <Text style={styles.cardBodyText}>
                Certificate No: {data.learningPath?.certificate?.certificateNumber || 'Not Issued Yet'}
              </Text>
              <Text style={styles.cardBodyText}>
                Starter Coupon Objective: {data.couponSelling?.redeemed ?? 0} / {data.couponSelling?.required ?? 45}
              </Text>

              <TouchableOpacity
                style={[styles.solidPrimaryButton, { marginTop: 16 }]}
                activeOpacity={0.8}
                disabled={
                  requestCertification.isPending ||
                  !!data.learningPath?.certificate?.certificateNumber ||
                  !data.couponSelling?.complete
                }
                onPress={() => requestCertification.mutate()}
              >
                {requestCertification.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.solidPrimaryButtonText}>
                    {data.learningPath?.certificate?.certificateNumber
                      ? 'Certificate Issued ✓'
                      : 'Request Official Certification'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STAGE 7: ACTIVATION */}
          {activeStageKey === 'ACTIVATION' && (
            <View style={styles.activationCardCenter}>
              <Text style={styles.activationEmoji}>🎉</Text>
              <Text style={styles.cardTitleTextCenter}>
                {overviewData?.status === 'ACTIVE' ? "You're Activated!" : 'Activation Pending'}
              </Text>
              <Text style={styles.cardBodyTextCenter}>
                {overviewData?.status === 'ACTIVE'
                  ? 'Your Career Advisor console is fully active. You can now enroll candidates and generate purchase orders.'
                  : 'Complete training, agreement, and starter coupon sales to activate your console.'}
              </Text>
            </View>
          )}

          {query.isError && (
            <View style={styles.errorCardBox}>
              <Text style={styles.errorCardText}>
                Could not load content for this step. Check connection and try again.
              </Text>
            </View>
          )}
        </View>

        {/* ─── HOME PLATFORM CTA BANNER ─── */}
        {/* <View style={styles.ctaSection}>
          <View style={styles.ctaBanner}>
            <View style={styles.ctaDecorationCircle} />
            <Text style={styles.ctaTitle}>Advisor Support Center</Text>
            <Text style={styles.ctaDescription}>
              Need assistance with your onboarding milestones or institutional mapping? Reach out to your regional TSO admin.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.ctaButtonText}>Contact Support Console</Text>
            </TouchableOpacity>
          </View>
        </View> */}
      </ScrollView>

      {/* VIDEO PLAYER MODAL */}
      {activeVideo && (
        <AdvisorLmsVideoPlayer
          key={`${activeVideo.kind}-${activeVideo.videoId}`}
          visible
          title={activeVideo.title}
          url={activeVideo.url}
          videoId={activeVideo.videoId}
          kind={activeVideo.kind}
          moduleId={activeVideo.moduleId}
          onClose={() => setActiveVideo(null)}
          onUpdated={refreshLms}
        />
      )}
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
  heroSubtitle: { color: 'rgba(199, 210, 254, 0.8)', fontSize: 12, lineHeight: 18 },

  // VALUE TRUST RIBBON
  trustSection: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#FFFFFF' },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12 },
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trustEmoji: { fontSize: 13, marginRight: 6 },
  trustText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  trustDivider: { width: 1, backgroundColor: '#E2E8F0', height: 14, alignSelf: 'center' },

  // CATEGORY & MILESTONE PILLED TABS
  categoryFilterSection: { paddingVertical: 16, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  sectionHeadingText: { fontSize: 15, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12, letterSpacing: -0.3 },
  sectionHeadingTextNoPadding: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4, letterSpacing: -0.3 },
  categoryScrollContainer: { paddingHorizontal: 20 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  categoryTabActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  categoryTabComplete: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  categoryTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  categoryTabText: { fontSize: 12, fontWeight: '600' },
  textWhite: { color: '#FFFFFF' },
  textEmerald: { color: '#047857' },
  textSlate700: { color: '#475569' },

  // FEED & CONTENT SECTIONS
  contentFeedSection: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  stageHeaderBlock: { marginBottom: 12 },
  stageSubtitleText: { fontSize: 12, color: '#64748B', lineHeight: 18 },

  // CARDS & CAROUSELS
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardLockedOpacity: { opacity: 0.6, backgroundColor: '#F8FAFC' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitleText: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, paddingRight: 8 },
  cardTitleTextCenter: { fontSize: 15, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 6 },
  cardBodyText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  cardBodyTextMargin: { fontSize: 12, color: '#64748B', lineHeight: 18, marginTop: 8 },
  cardBodyTextCenter: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  inlineStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  // BADGES
  badgeSuccess: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSuccessText: { color: '#047857', fontSize: 10, fontWeight: '700' },
  badgeLocked: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeLockedText: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  badgePrimary: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePrimaryText: { color: '#4F46E5', fontSize: 10, fontWeight: '700' },

  // MCQ STYLES
  questionTitleText: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 10, lineHeight: 18 },
  mcqOptionsList: { gap: 8 },
  mcqOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  mcqOptionItemSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  mcqOptionText: { fontSize: 12, color: '#475569', flex: 1 },
  mcqOptionTextSelected: { fontWeight: '700', color: '#4F46E5' },

  // BUTTONS
  actionButtonGroup: { marginTop: 12, gap: 8 },
  outlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  outlineActionText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
  solidPrimaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidPrimaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // AGREEMENT STYLES
  agreementBodyScrollView: { maxHeight: 160, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginTop: 10 },
  agreementBodyText: { fontSize: 11, color: '#475569', lineHeight: 16 },
  checkboxTouchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkboxLabelText: { fontSize: 12, color: '#0F172A', flex: 1 },

  // ACTIVATION & ERRORS
  activationCardCenter: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  activationEmoji: { fontSize: 36, marginBottom: 10 },
  errorCardBox: { padding: 16, backgroundColor: '#FEF2F2', borderRadius: 10, marginTop: 12 },
  errorCardText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },

  // FOOTER CTA BANNER
  ctaSection: { paddingVertical: 24, backgroundColor: '#FFFFFF' },
  ctaBanner: { marginHorizontal: 20, backgroundColor: '#4F46E5', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  ctaDecorationCircle: { position: 'absolute', right: -20, bottom: -20, width: 96, height: 96, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 48 },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  ctaDescription: { color: '#E0E7FF', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  ctaButton: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctaButtonText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
});