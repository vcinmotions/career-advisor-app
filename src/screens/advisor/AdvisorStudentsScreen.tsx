import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { smartSkillsClient, apiErrorMessage, unwrapList } from '../../api/smartSkillsClient';
import { Ionicons } from '@expo/vector-icons';

export default function AdvisorStudentsScreen() {
  const queryClient = useQueryClient();
  const stages = ['NEW_LEAD', 'COUNSELLING', 'FOLLOW_UP', 'ADMISSION', 'DROPPED'] as const;
  const [activeTab, setActiveTab] = useState<(typeof stages)[number]>('NEW_LEAD');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState<any>(null);
  const [showAdmissionModal, setShowAdmissionModal] = useState<any>(null);

  // Form States
  const [leadName, setLeadName] = useState('');
  const [leadMobile, setLeadMobile] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadAddress, setLeadAddress] = useState('');
  const [leadPincode, setLeadPincode] = useState('');

  const [followUpNotes, setFollowUpNotes] = useState('');
  const [nextStage, setNextStage] = useState<'NEW_LEAD' | 'COUNSELLING' | 'FOLLOW_UP' | 'DROPPED'>('FOLLOW_UP');

  const [admissionCourseId, setAdmissionCourseId] = useState('');
  const [admissionPassword, setPassword] = useState('');
  const [admissionCoupon, setCoupon] = useState('');
  const [admissionEmail, setAdmissionEmail] = useState('');
  const [admissionAddress, setAdmissionAddress] = useState('');

  // Fetch Students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['advisorStudents', activeTab],
    queryFn: async () => {
      const res = await smartSkillsClient.get('/students/leads', { params: { stage: activeTab } });
      return unwrapList(res.data);
    },
  });

  // Fetch Courses
  const { data: courses = [] } = useQuery({
    queryKey: ['availableCourses'],
    queryFn: async () => unwrapList((await smartSkillsClient.get('/courses')).data),
  });

  // Create Lead
  const createLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await smartSkillsClient.post('/students/leads', {
        name: leadName,
        mobile: leadMobile,
        email: leadEmail || undefined,
        address: leadAddress || undefined,
        pincode: leadPincode || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Lead added successfully!');
      setShowCreateModal(false);
      setLeadName('');
      setLeadMobile('');
      setLeadEmail('');
      setLeadAddress('');
      setLeadPincode('');
      queryClient.invalidateQueries({ queryKey: ['advisorStudents'] });
    },
    onError: (err: any) => Alert.alert('Error', apiErrorMessage(err, 'Failed to add lead.')),
  });

  // Follow-Up
  const followUpMutation = useMutation({
    mutationFn: async () => {
      const res = await smartSkillsClient.post(`/students/leads/${showFollowUpModal.id}/follow-ups`, {
        notes: followUpNotes,
        newStage: nextStage,
      });
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Logged', 'Follow-up saved successfully');
      setShowFollowUpModal(null);
      setFollowUpNotes('');
      queryClient.invalidateQueries({ queryKey: ['advisorStudents'] });
    },
    onError: (err: any) => Alert.alert('Error', apiErrorMessage(err, 'Failed to save follow-up.')),
  });

  // Admission Conversion
  const convertAdmissionMutation = useMutation({
    mutationFn: async () => {
      const res = await smartSkillsClient.post(`/students/leads/${showAdmissionModal.id}/convert-admission`, {
        email: admissionEmail.trim().toLowerCase(),
        address: admissionAddress.trim(),
        password: admissionPassword,
        courseId: admissionCourseId || undefined,
        couponCode: admissionCoupon || undefined,
      });
      return res.data;
    },
    onSuccess: (response) => {
      const emailSent = response.data?.data?.credentialsEmailSent !== false;
      Alert.alert(
        'Admitted!',
        emailSent
          ? 'Student account created and credentials emailed to the student.'
          : 'Student account was created, but credential email failed. Contact support.'
      );
      setShowAdmissionModal(null);
      setPassword('');
      setCoupon('');
      setAdmissionCourseId('');
      queryClient.invalidateQueries({ queryKey: ['advisorStudents'] });
    },
    onError: (err: any) => Alert.alert('Conversion Failed', apiErrorMessage(err, 'Check required details.')),
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HERO BANNER ─── */}
      <View style={styles.heroSection}>
        <View style={styles.heroBanner}>
          <View style={styles.heroDecorationRight} />
          <View style={styles.heroDecorationLeft} />

          <View style={styles.zIndexHigh}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>👥 LEAD MANAGEMENT CONSOLE</Text>
            </View>
            <Text style={styles.heroTitle}>Student Acquisition Pipeline</Text>
            <Text style={styles.heroSubtitle}>
              Track candidate leads, log interaction follow-ups, and convert admissions.
            </Text>
            <TouchableOpacity
              style={styles.heroButton}
              activeOpacity={0.8}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.heroButtonText}>+ Add New Lead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── VALUE MATRIX TRUST BAR ─── */}
      {/* <View style={styles.trustSection}>
        <View style={styles.trustBar}>
          <View style={styles.trustItem}>
            <Text style={styles.trustEmoji}>🎯</Text>
            <Text style={styles.trustText}>Active Pipeline</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustEmoji}>⚡</Text>
            <Text style={styles.trustText}>Instant Enroll</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustEmoji}>📜</Text>
            <Text style={styles.trustText}>Direct Ledger</Text>
          </View>
        </View>
      </View> */}

      {/* ─── HORIZONTAL STAGE TAG BAR ─── */}
      <View style={styles.categoryFilterSection}>
        <Text style={styles.sectionHeadingText}>Pipeline Stages</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContainer}
        >
          {stages.map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
                style={[
                  styles.categoryTab,
                  isSelected ? styles.categoryTabActive : styles.categoryTabInactive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    isSelected ? styles.textWhite : styles.textSlate700,
                  ]}
                >
                  {tab.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── CANDIDATE LEADS LIST ─── */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.centerLoadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Syncing lead pipeline...</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateTitle}>No candidates in {activeTab.replace('_', ' ')}</Text>
            <Text style={styles.emptyStateDescription}>
              Tap the "+ Add New Lead" button above to capture a new student lead.
            </Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={styles.premiumCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <View style={styles.badgePrimary}>
                    <Text style={styles.badgePrimaryText}>{item.stage.replace('_', ' ')}</Text>
                  </View>
                </View>

                <View style={styles.infoRowText}>
                  <Ionicons name="call-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.subText}>{item.mobile}</Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Ionicons name="mail-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.subText} numberOfLines={1}>{item.email || 'N/A'}</Text>
                </View>

                <View style={styles.infoRowText}>
                  <Ionicons name="location-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.subText} numberOfLines={1}>{item.address || 'No Address Recorded'}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.outlineActionButton}
                    activeOpacity={0.8}
                    onPress={() => setShowFollowUpModal(item)}
                  >
                    <Ionicons name="chatbubbles-outline" size={15} color="#4F46E5" style={{ marginRight: 6 }} />
                    <Text style={styles.outlineActionText}>Log Follow-Up</Text>
                  </TouchableOpacity>

                  {item.stage !== 'ADMISSION' && (
                    <TouchableOpacity
                      style={styles.solidEmeraldButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        setAdmissionEmail(item.email || '');
                        setAdmissionAddress(item.address || '');
                        setShowAdmissionModal(item);
                      }}
                    >
                      <Ionicons name="school-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.solidEmeraldButtonText}>Convert Admission</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* ─── CREATE LEAD MODAL ─── */}
      <Modal visible={showCreateModal} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add New Student Lead</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={leadName} onChangeText={setLeadName} placeholder="Jane Doe" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput style={styles.input} value={leadMobile} onChangeText={setLeadMobile} keyboardType="phone-pad" maxLength={10} placeholder="10 Digit Indian Mobile" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} value={leadEmail} onChangeText={setLeadEmail} keyboardType="email-address" autoCapitalize="none" placeholder="student@example.com" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Residential Address</Text>
            <TextInput style={styles.input} value={leadAddress} onChangeText={setLeadAddress} placeholder="Street Address" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={leadPincode} onChangeText={setLeadPincode} keyboardType="numeric" placeholder="Pincode" placeholderTextColor="#94A3B8" />

            <TouchableOpacity style={styles.submitBtn} onPress={() => createLeadMutation.mutate()} disabled={createLeadMutation.isPending}>
              {createLeadMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Candidate Lead →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── CONVERT ADMISSION MODAL ─── */}
      <Modal visible={!!showAdmissionModal} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Convert to Admission</Text>
                <Text style={styles.modalSubtitle}>Candidate: {showAdmissionModal?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdmissionModal(null)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Student Email Address *</Text>
            <TextInput style={styles.input} value={admissionEmail} onChangeText={setAdmissionEmail} keyboardType="email-address" autoCapitalize="none" placeholder="student@example.com" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Residential Address *</Text>
            <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]} value={admissionAddress} onChangeText={setAdmissionAddress} multiline placeholder="Full residential address" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Select Assigned Course *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {courses.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, admissionCourseId === c.id && styles.activeChip]}
                  onPress={() => setAdmissionCourseId(c.id)}
                >
                  <Text style={[styles.chipText, admissionCourseId === c.id && styles.activeChipText]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Set Portal Temporary Password *</Text>
            <TextInput style={styles.input} secureTextEntry value={admissionPassword} onChangeText={setPassword} placeholder="Minimum 8 characters" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Assign Coupon Code (Optional)</Text>
            <TextInput style={styles.input} value={admissionCoupon} onChangeText={setCoupon} placeholder="ENTER COUPON CODE" placeholderTextColor="#94A3B8" autoCapitalize="characters" />

            <TouchableOpacity
              style={styles.submitEmeraldBtn}
              onPress={() => convertAdmissionMutation.mutate()}
              disabled={
                convertAdmissionMutation.isPending ||
                !admissionCourseId ||
                admissionPassword.length < 8 ||
                !/^\S+@\S+\.\S+$/.test(admissionEmail.trim()) ||
                admissionAddress.trim().length < 5
              }
            >
              {convertAdmissionMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Complete Admission Conversion ✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdmissionModal(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── FOLLOW-UP MODAL ─── */}
      <Modal visible={!!showFollowUpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Log Follow-Up Activity</Text>
              <TouchableOpacity onPress={() => setShowFollowUpModal(null)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Interaction Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline
              placeholder="Notes on candidate counseling discussion..."
              placeholderTextColor="#94A3B8"
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
            />

            <Text style={styles.label}>Update Pipeline Stage</Text>
            <View style={styles.chipGridRow}>
              {(['NEW_LEAD', 'COUNSELLING', 'FOLLOW_UP', 'DROPPED'] as const).map((stage) => (
                <TouchableOpacity
                  key={stage}
                  style={[styles.chip, nextStage === stage && styles.activeChip]}
                  onPress={() => setNextStage(stage)}
                >
                  <Text style={[styles.chipText, nextStage === stage && styles.activeChipText]}>{stage.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={() => followUpMutation.mutate()} disabled={followUpMutation.isPending}>
              {followUpMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Activity Log →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFollowUpModal(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // CORE BACKGROUND CONTEXTS
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  listContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  centerLoadingContainer: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 10 },

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
  heroSubtitle: { color: 'rgba(199, 210, 254, 0.8)', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  heroButton: { backgroundColor: '#10B981', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  heroButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // VALUE TRUST RIBBON
  trustSection: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12 },
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trustEmoji: { fontSize: 13, marginRight: 6 },
  trustText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  trustDivider: { width: 1, backgroundColor: '#E2E8F0', height: 14, alignSelf: 'center' },

  // CATEGORY & STAGE TABS
  categoryFilterSection: { paddingVertical: 12, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  sectionHeadingText: { fontSize: 15, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12, letterSpacing: -0.3 },
  categoryScrollContainer: { paddingHorizontal: 20 },
  categoryTab: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  categoryTabActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  categoryTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  categoryTabText: { fontSize: 12, fontWeight: '600' },
  textWhite: { color: '#FFFFFF' },
  textSlate700: { color: '#475569' },

  // PREMIUM CARDS
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  badgePrimary: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePrimaryText: { color: '#4F46E5', fontSize: 10, fontWeight: '700' },
  infoRowText: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subText: { fontSize: 12, color: '#64748B' },
  dotSeparator: { marginHorizontal: 6, color: '#CBD5E1', fontSize: 10 },

  // ACTION BUTTONS
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  outlineActionButton: {
    flex: 1,
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
  solidEmeraldButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
  },
  solidEmeraldButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // EMPTY STATE
  emptyStateBox: { marginHorizontal: 20, padding: 32, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, alignItems: 'center' },
  emptyStateEmoji: { fontSize: 36, marginBottom: 8 },
  emptyStateTitle: { color: '#0F172A', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  emptyStateDescription: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // MODALS
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6, color: '#475569' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14, height: 46, backgroundColor: '#FFFFFF', fontSize: 13, color: '#0F172A' },
  chipGridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { borderColor: '#E2E8F0', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC' },
  activeChip: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  activeChipText: { color: '#FFFFFF', fontWeight: '700' },
  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitEmeraldBtn: { backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
});