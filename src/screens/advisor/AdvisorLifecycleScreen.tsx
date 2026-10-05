import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import AdvisorLmsVideoPlayer from './AdvisorLmsVideoPlayer';

const SECTIONS: Record<string, { title: string; path: string }> = {
  AdvisorOrientation: { title: 'CA Orientation', path: '/lms/me/orientation/overview' },
  AdvisorTraining: { title: 'CA Training', path: '/lms/me/training/overview' },
  AdvisorMcq: { title: 'CA MCQ / Exam', path: '/lms/me/assessment' },
  AdvisorInternship: { title: 'CA Internship', path: '/lms/me/overview' },
  AdvisorAgreement: { title: 'CA Agreement', path: '/lms/me/agreement' },
  AdvisorCertification: { title: 'CA Certification', path: '/lms/me/overview' },
};

export default function AdvisorLifecycleScreen({ route, navigation }: any) {
  const config = SECTIONS[route.name] || SECTIONS.AdvisorOrientation;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [activeVideo, setActiveVideo] = useState<any>(null);
  const [agreementChecks, setAgreementChecks] = useState({ terms: false, privacy: false, conduct: false });
  const query = useQuery({
    queryKey: ['ca-lifecycle', config.path],
    queryFn: async () => (await mobileApiClient.get(config.path)).data?.data,
  });
  const questions = useMemo(() => query.data?.questions || [], [query.data]);
  const refreshLms = useCallback(() => { void query.refetch(); }, [query.refetch]);
  const completeModule = useMutation({
    mutationFn: (moduleId: string) => mobileApiClient.post(`/lms/me/training/modules/${moduleId}/complete`, {}),
    onSuccess: () => { void query.refetch(); },
    onError: (error: any) => Alert.alert('Could not complete module', error?.response?.data?.message || 'Complete the required work and try again.'),
  });
  const requestCertification = useMutation({
    mutationFn: () => mobileApiClient.post('/career-advisors/me/certify-after-coupon-target', {}),
    onSuccess: () => { Alert.alert('Certification requested', 'Smart Skills recorded your certification request.'); void query.refetch(); },
    onError: (error: any) => Alert.alert('Certification unavailable', error?.response?.data?.message || 'Complete the required onboarding and coupon target first.'),
  });

  const acceptAgreement = useMutation({
    mutationFn: async () => {
      const agreementId = query.data?.id || query.data?.agreementId || query.data?.agreement?.id;
      if (!agreementId || !agreementChecks.terms || !agreementChecks.privacy || !agreementChecks.conduct) {
        throw new Error('Review the agreement and accept all three statements to continue.');
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
      Alert.alert('Agreement', 'Smart Skills recorded your acceptance.');
      query.refetch();
    },
    onError: (error: any) => Alert.alert('Agreement', error?.response?.data?.message || 'Could not accept agreement'),
  });

  const submitMcq = useMutation({
    mutationFn: async () => {
      if (!questions.length || questions.some((entry: any) => !answers[(entry.question || entry).id]?.length)) {
        throw new Error('Answer every question before submitting.');
      }
      const payload = Object.entries(answers).map(([questionId, optionIds]) => ({
        questionId,
        selectedOptionIds: optionIds,
      }));
      return mobileApiClient.post('/lms/me/assessment/submit', { answers: payload });
    },
    onSuccess: (response) => {
      const result = response.data?.data;
      Alert.alert('Exam result', `${result?.passed ? 'PASSED' : 'Not passed'} — ${result?.percentage ?? 0}% (${result?.correct ?? 0}/${result?.total ?? 0}). Smart Skills records the official result.`);
      query.refetch();
    },
    onError: (error: any) => Alert.alert('Exam', error?.response?.data?.message || 'Could not submit exam'),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const data = query.data || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.hint}>Progress and completion are decided by Smart Skills, not this app.</Text>

        {route.name === 'AdvisorOrientation' && (
          <>
            <Text style={styles.metric}>Completed: {data.completedVideos ?? 0} / {data.totalVideos ?? 0}</Text>
            {(data.videos || data.items || []).map((item: any, index: number) => {
              const video = item.video || item;
              const completed = item.progress?.isCompleted || item.isCompleted;
              const videoId = item.videoAssetId || video.videoAssetId || video.id;
              return <TouchableOpacity key={item.id || video.id || index} style={styles.card} disabled={item.isLocked || completed || !video.url} onPress={() => setActiveVideo({ kind: 'orientation', videoId, title: video.title || item.title, url: video.url })}>
                <Text style={styles.cardTitle}>{video.title || item.title || 'Orientation video'}</Text>
                <Text style={styles.meta}>{item.isLocked ? 'Locked' : completed ? 'Completed' : 'Tap to watch and save progress'}</Text>
              </TouchableOpacity>;
            })}
          </>
        )}

        {route.name === 'AdvisorTraining' && (
          <>
            <Text style={styles.metric}>{data.completedModules || 0} / {data.totalModules || 0} modules</Text>
            {(data.modules || data.withProgress || []).map((item: any) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.isLocked ? 'Locked' : item.isCompleted ? 'Completed' : 'Pending'}</Text>
                {!item.isLocked && !item.isCompleted && !!item.videoUrl && !!item.videoAssetId && <TouchableOpacity style={styles.button} onPress={() => setActiveVideo({ kind: 'training', videoId: item.videoAssetId, moduleId: item.id, title: item.title, url: item.videoUrl })}><Text style={styles.buttonText}>Watch training video</Text></TouchableOpacity>}
                {!item.isLocked && !item.isCompleted && !item.videoUrl && <TouchableOpacity style={styles.button} disabled={completeModule.isPending} onPress={async () => { if (item.pdfUrl) await Linking.openURL(item.pdfUrl); completeModule.mutate(item.id); }}><Text style={styles.buttonText}>{item.pdfUrl ? 'Open material and complete module' : 'Complete module'}</Text></TouchableOpacity>}
              </View>
            ))}
          </>
        )}

        {route.name === 'AdvisorMcq' && (
          <>
            <Text style={styles.meta}>Server evaluates score / passingScore / passed / attempt.</Text>
            {questions.map((entry: any) => {
              const question = entry.question || entry;
              return (
                <View key={question.id} style={styles.card}>
              <Text style={styles.cardTitle}>{question.questionText || question.prompt || question.question || question.text}</Text>
                  {(question.options || []).map((option: any) => (
                    <TouchableOpacity key={option.id} onPress={() => setAnswers((current) => {
                      const selected = current[question.id] || [];
                      const next = question.type === 'MULTIPLE_CORRECT'
                        ? selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id]
                        : [option.id];
                      return { ...current, [question.id]: next };
                    })}>
                      <Text style={(answers[question.id] || []).includes(option.id) ? styles.selected : styles.option}>{option.optionText || option.text || option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            <TouchableOpacity style={styles.button} onPress={() => submitMcq.mutate()} disabled={submitMcq.isPending}>
              <Text style={styles.buttonText}>Submit answers</Text>
            </TouchableOpacity>
          </>
        )}

        {route.name === 'AdvisorInternship' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{data.learningPath?.internshipAssignment?.program?.title || 'Internship assignment'}</Text>
            <Text style={styles.meta}>Status: {data.learningPath?.internshipAssignment?.status || 'Not assigned yet'}</Text>
            <Text style={styles.meta}>Smart Skills assigns and records the internship stage here.</Text>
          </View>
        )}

        {route.name === 'AdvisorAgreement' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{data.agreement?.title || 'Smart Skills Agreement'}</Text>
              <Text style={styles.meta}>{data.signature ? 'Accepted' : 'Pending'}</Text>
              {!!data.agreement?.bodyHtml && <Text style={styles.agreementBody}>{String(data.agreement.bodyHtml).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()}</Text>}
              {data.agreement?.termsUrl && <Text style={styles.link} onPress={() => Linking.openURL(data.agreement.termsUrl)}>Open terms document</Text>}
              {data.agreement?.privacyPolicyUrl && <Text style={styles.link} onPress={() => Linking.openURL(data.agreement.privacyPolicyUrl)}>Open privacy policy</Text>}
              {data.agreement?.codeOfConductUrl && <Text style={styles.link} onPress={() => Linking.openURL(data.agreement.codeOfConductUrl)}>Open code of conduct</Text>}
            </View>
            {([
              ['terms', 'I accept the terms of this agreement.'],
              ['privacy', 'I acknowledge the privacy policy.'],
              ['conduct', 'I agree to follow the code of conduct.'],
            ] as const).map(([key, label]) => <TouchableOpacity key={key} style={styles.checkRow} disabled={!!data.signature} onPress={() => setAgreementChecks((current) => ({ ...current, [key]: !current[key] }))}><Text style={styles.checkbox}>{agreementChecks[key] ? '☑' : '☐'}</Text><Text style={styles.meta}>{label}</Text></TouchableOpacity>)}
            <TouchableOpacity style={styles.button} onPress={() => acceptAgreement.mutate()} disabled={acceptAgreement.isPending || !!data.signature || !data.agreement?.id || !agreementChecks.terms || !agreementChecks.privacy || !agreementChecks.conduct}>
              <Text style={styles.buttonText}>Accept / Sign</Text>
            </TouchableOpacity>
          </>
        )}

        {route.name === 'AdvisorCertification' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{data.learningPath?.certificate?.certificateNumber ? 'Certified' : 'Certification'}</Text>
            <Text style={styles.meta}>Certificate: {data.learningPath?.certificate?.certificateNumber || 'Not issued'}</Text>
            <Text style={styles.meta}>Coupon target: {data.couponSelling?.redeemed ?? 0} / {data.couponSelling?.required ?? 0}</Text>
            <TouchableOpacity style={styles.button} disabled={requestCertification.isPending || !!data.learningPath?.certificate?.certificateNumber || !data.couponSelling?.complete} onPress={() => requestCertification.mutate()}>
              {requestCertification.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Request certification</Text>}
            </TouchableOpacity>
          </View>
        )}

        {query.isError && <Text style={styles.error}>Could not load this step. Check your connection and try again.</Text>}

        <View style={styles.navRow}>
          {Object.keys(SECTIONS).map((name) => (
            <TouchableOpacity key={name} onPress={() => navigation.navigate(name)}>
              <Text style={route.name === name ? styles.navActive : styles.nav}>{SECTIONS[name].title.replace('CA ', '')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {activeVideo && <AdvisorLmsVideoPlayer key={`${activeVideo.kind}-${activeVideo.videoId}`} visible title={activeVideo.title} url={activeVideo.url} videoId={activeVideo.videoId} kind={activeVideo.kind} moduleId={activeVideo.moduleId} onClose={() => setActiveVideo(null)} onUpdated={refreshLms} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  hint: { color: '#64748B', marginVertical: 8 },
  metric: { fontWeight: '700', marginBottom: 12, color: '#4F46E5' },
  card: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTitle: { fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  meta: { color: '#64748B', marginBottom: 4 },
  option: { paddingVertical: 8, color: '#334155' },
  selected: { paddingVertical: 8, color: '#4F46E5', fontWeight: '700' },
  button: { backgroundColor: '#4F46E5', height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  nav: { color: '#64748B', fontSize: 12 },
  navActive: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
  error: { color: '#B91C1C', marginTop: 12 },
  agreementBody: { color: '#334155', lineHeight: 20, marginTop: 10 },
  link: { color: '#4F46E5', fontWeight: '700', marginTop: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { color: '#4F46E5', fontSize: 20 },
});
