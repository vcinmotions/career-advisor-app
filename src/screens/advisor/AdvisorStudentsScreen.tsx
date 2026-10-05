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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { smartSkillsClient, apiErrorMessage, unwrapList } from '../../api/smartSkillsClient';

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
        courseId: admissionCourseId,
        couponCode: admissionCoupon || undefined,
      });
      return res.data;
    },
    onSuccess: (response) => {
      const emailSent = response.data?.data?.credentialsEmailSent !== false;
      Alert.alert('Admitted!', emailSent ? 'Student account created and credentials emailed to the student.' : 'Student account was created, but the credential email could not be sent. Please contact support before retrying.');
      setShowAdmissionModal(null);
      setPassword('');
      setCoupon('');
      setAdmissionCourseId('');
      queryClient.invalidateQueries({ queryKey: ['advisorStudents'] });
    },
    onError: (err: any) => Alert.alert('Conversion Failed', apiErrorMessage(err, 'Check required details.')),
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lead Management</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createBtnText}>+ Add Lead</Text>
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {stages.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LIST */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4F46E5" />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.subText}>📱 {item.mobile} | ✉️ {item.email || 'N/A'}</Text>
              <Text style={styles.subText}>📍 {item.address || 'No Address'}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setShowFollowUpModal(item)}>
                  <Text style={styles.actionBtnOutlineText}>+ Follow Up</Text>
                </TouchableOpacity>

                {item.stage !== 'ADMISSION' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => { setAdmissionEmail(item.email || ''); setAdmissionAddress(item.address || ''); setShowAdmissionModal(item); }}>
                    <Text style={styles.actionBtnText}>Convert Admission</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* CREATE LEAD MODAL */}
      <Modal visible={showCreateModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <ScrollView>
            <Text style={styles.modalTitle}>Add New Student Lead</Text>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={leadName} onChangeText={setLeadName} placeholder="Student Name" />

            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput style={styles.input} value={leadMobile} onChangeText={setLeadMobile} keyboardType="phone-pad" maxLength={10} placeholder="10 Digit Number" />

            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} value={leadEmail} onChangeText={setLeadEmail} keyboardType="email-address" autoCapitalize="none" placeholder="student@gmail.com" />

            <Text style={styles.label}>Residential Address</Text>
            <TextInput style={styles.input} value={leadAddress} onChangeText={setLeadAddress} placeholder="Street Address" />

            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={leadPincode} onChangeText={setLeadPincode} keyboardType="numeric" placeholder="Pincode" />

            <TouchableOpacity style={styles.submitBtn} onPress={() => createLeadMutation.mutate()} disabled={createLeadMutation.isPending}>
              {createLeadMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Lead</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* CONVERT ADMISSION MODAL */}
      <Modal visible={!!showAdmissionModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <ScrollView>
            <Text style={styles.modalTitle}>Convert to Admission</Text>
            <Text style={styles.subText}>Student: {showAdmissionModal?.name}</Text>

            <Text style={styles.label}>Student email *</Text>
            <TextInput style={styles.input} value={admissionEmail} onChangeText={setAdmissionEmail} keyboardType="email-address" autoCapitalize="none" placeholder="student@example.com" />
            <Text style={styles.label}>Residential address *</Text>
            <TextInput style={[styles.input, { minHeight: 72 }]} value={admissionAddress} onChangeText={setAdmissionAddress} multiline placeholder="Full address" />

            <Text style={styles.label}>Select Course *</Text>
            <ScrollView horizontal style={{ marginVertical: 8 }}>
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

            <Text style={styles.label}>Set Student Portal Password *</Text>
            <TextInput style={styles.input} secureTextEntry value={admissionPassword} onChangeText={setPassword} placeholder="Min 8 characters" />

            <Text style={styles.label}>Assign Coupon Code (Optional)</Text>
            <TextInput style={styles.input} value={admissionCoupon} onChangeText={setCoupon} placeholder="Enter Coupon Code" autoCapitalize="characters" />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => convertAdmissionMutation.mutate()}
              disabled={convertAdmissionMutation.isPending || !admissionCourseId || admissionPassword.length < 8 || !/^\S+@\S+\.\S+$/.test(admissionEmail.trim()) || admissionAddress.trim().length < 5}
            >
              {convertAdmissionMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Complete Admission</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdmissionModal(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* FOLLOW-UP MODAL */}
      <Modal visible={!!showFollowUpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Log Follow-Up</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder="Notes on discussion..."
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
            />
            <Text style={styles.label}>Update stage</Text>
            <View style={styles.actionRow}>{(['NEW_LEAD', 'COUNSELLING', 'FOLLOW_UP', 'DROPPED'] as const).map((stage) => (
              <TouchableOpacity key={stage} style={[styles.chip, nextStage === stage && styles.activeChip]} onPress={() => setNextStage(stage)}>
                <Text style={[styles.chipText, nextStage === stage && styles.activeChipText]}>{stage.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}</View>
            <TouchableOpacity style={styles.submitBtn} onPress={() => followUpMutation.mutate()} disabled={followUpMutation.isPending}>
              {followUpMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Log</Text>}
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
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  createBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: '#FFF', fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#E2E8F0' },
  activeTab: { borderBottomColor: '#4F46E5' },
  tabText: { color: '#64748B', fontWeight: '600', fontSize: 12 },
  activeTabText: { color: '#4F46E5', fontWeight: '800' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  studentName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  subText: { fontSize: 13, color: '#64748B', marginTop: 4 },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtnOutline: { flex: 1, borderWidth: 1, borderColor: '#4F46E5', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  actionBtnOutlineText: { color: '#4F46E5', fontWeight: '700', fontSize: 12 },
  actionBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, height: 44, backgroundColor: '#FFF' },
  chip: { borderColor: '#CBD5E1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, backgroundColor: '#F1F5F9' },
  activeChip: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 12, color: '#334155' },
  activeChipText: { color: '#FFF', fontWeight: '700' },
  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFF', fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#EF4444', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4, color: '#334155' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
});
