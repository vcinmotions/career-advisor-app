import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { getSecureItem, removeSecureItem, setSecureItem } from '../../api/client';
import { apiErrorMessage, smartSkillsClient, unwrapList } from '../../api/smartSkillsClient';

const ADVISOR_REGISTER_SESSION = 'advisor-register-session';

const DOCUMENT_TYPES = [
  { label: 'Aadhaar Card', value: 'AADHAAR' },
  { label: 'PAN Card', value: 'PAN' },
  { label: 'Photograph', value: 'PHOTOGRAPH' },
  { label: 'Educational Certificate', value: 'EDUCATIONAL_CERTIFICATE' },
  { label: 'Bank Proof / Cheque', value: 'BANK_PROOF' },
  { label: 'Address Proof', value: 'ADDRESS_PROOF' },
  { label: 'Organization Proof / Registration', value: 'ORGANIZATION_PROOF' },
  { label: 'Tax Document (GST)', value: 'TAX_DOCUMENT' },
  { label: 'Other Document', value: 'OTHER' },
];

type StepType = 'PHONE_OTP' | 'PROFILE_FORM' | 'DOCUMENTS_UPLOAD';

interface UploadedDoc {
  type: string;
  fileName: string;
  fileUri: string;
}

export default function AdvisorSignUpScreen({ navigation }: any) {
  const [step, setStep] = useState<StepType>('PHONE_OTP');

  // Step 1 State: Email & Phone OTP
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registrationToken, setRegistrationToken] = useState('');

  // Step 2 State: Profile & Security Details
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [experienceYears, setExperienceYears] = useState('0');
  const [qualification, setQualification] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 State: Bank Details
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIFSC, setBankIFSC] = useState('');
  const [bankName, setBankName] = useState('');

  // Jurisdiction Cascading State
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<{ id: string; name: string } | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<{ id: string; name: string; code: string } | null>(null);
  const [selectedSector, setSelectedSector] = useState<{ id: string; sectorId?: string; name: string } | null>(null);
  const [selectedInstitute, setSelectedInstitute] = useState<{ id: string; name: string; code?: string } | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'STATE' | 'DISTRICT' | 'TERRITORY' | 'SECTOR' | 'INSTITUTE' | 'GENDER' | 'DOC_TYPE' | null
  >(null);

  // Step 3 State: Documents
  const [currentDocType, setCurrentDocType] = useState(DOCUMENT_TYPES[0].value);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = await getSecureItem(ADVISOR_REGISTER_SESSION);
      if (!raw || !active) return;
      try {
        const saved = JSON.parse(raw) as {
          phone?: string;
          email?: string;
          registrationToken?: string;
          step?: 'PROFILE_FORM' | 'DOCUMENTS_UPLOAD';
        };
        if (saved.phone && saved.registrationToken && saved.step) {
          setPhone(saved.phone);
          setEmail(saved.email || '');
          setRegistrationToken(saved.registrationToken);
          setOtpSent(true);
          setStep(saved.step);
        }
      } catch {
        await removeSecureItem(ADVISOR_REGISTER_SESSION);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveSession = async (nextStep: 'PROFILE_FORM' | 'DOCUMENTS_UPLOAD', token = registrationToken) => {
    await setSecureItem(
      ADVISOR_REGISTER_SESSION,
      JSON.stringify({
        phone,
        email: email.trim().toLowerCase(),
        registrationToken: token,
        step: nextStep,
      })
    );
  };

  // Lookups
  const { data: rawStates = [] } = useQuery({
    queryKey: ['advisorStates'],
    queryFn: async () => unwrapList((await smartSkillsClient.get('/states/all')).data),
    enabled: step === 'PROFILE_FORM',
  });

  useEffect(() => {
    if (rawStates.length > 0 && !selectedStateId) {
      const mhState = rawStates.find((s: any) => String(s.name).toLowerCase() === 'maharashtra');
      setSelectedStateId(mhState ? mhState.id : rawStates[0].id);
    }
  }, [rawStates, selectedStateId]);

  const { data: rawDistricts = [], isFetching: loadingDistricts } = useQuery({
    queryKey: ['advisorDistricts', selectedStateId],
    queryFn: async () => unwrapList((await smartSkillsClient.get(`/districts/state/${selectedStateId}`)).data),
    enabled: step === 'PROFILE_FORM' && !!selectedStateId,
  });

  const { data: rawTerritories = [], isFetching: loadingTerritories } = useQuery({
    queryKey: ['advisorTerritories', selectedDistrict?.id],
    queryFn: async () =>
      unwrapList((await smartSkillsClient.get(`/territories/by-district/${selectedDistrict!.id}`)).data),
    enabled: step === 'PROFILE_FORM' && !!selectedDistrict?.id,
  });

  const { data: rawSectors = [], isFetching: loadingSectors } = useQuery({
    queryKey: ['advisorSectors', selectedTerritory?.id],
    queryFn: async () =>
      unwrapList(
        (
          await smartSkillsClient.get('/territories/sectors', {
            params: { territoryId: selectedTerritory!.id, status: 'active' },
          })
        ).data
      ),
    enabled: step === 'PROFILE_FORM' && !!selectedTerritory?.id,
  });

  const selectedTerritorySectorId = selectedSector?.id || '';

  const { data: rawInstitutes = [], isFetching: loadingInstitutes } = useQuery({
    queryKey: ['advisorInstitutes', selectedTerritorySectorId],
    queryFn: async () =>
      unwrapList(
        (
          await smartSkillsClient.get('/institutes/public', {
            params: { territorySectorId: selectedTerritorySectorId },
          })
        ).data
      ),
    enabled: step === 'PROFILE_FORM' && !!selectedTerritorySectorId,
  });

  const selectableInstitutes = useMemo(
    () =>
      rawInstitutes.filter(
        (inst: any) => inst.isActive !== false && inst.territorySectorId === selectedTerritorySectorId
      ),
    [rawInstitutes, selectedTerritorySectorId]
  );

  // Mutations
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await smartSkillsClient.post('/career-advisors/send-otp', {
        phone,
        email: email.trim().toLowerCase(),
      });
      return res.data;
    },
    onSuccess: () => {
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Verification code sent to your email address.');
    },
    onError: (err: any) => {
      Alert.alert('Error', apiErrorMessage(err, 'Failed to send OTP.'));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await smartSkillsClient.post('/career-advisors/verify-otp', { phone, code: otpCode });
      return res.data;
    },
    onSuccess: async (resData) => {
      const token = resData?.data?.registrationToken || resData?.registrationToken;
      const nextStep = resData?.data?.resumeStep === 'DOCUMENTS_UPLOAD' ? 'DOCUMENTS_UPLOAD' : 'PROFILE_FORM';
      setRegistrationToken(token);
      setStep(nextStep);
      await saveSession(nextStep, token);
    },
    onError: (err: any) => {
      Alert.alert('Verification Failed', apiErrorMessage(err, 'Invalid OTP code.'));
    },
  });

  const profileRegisterMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await smartSkillsClient.post('/career-advisors/register', payload, {
        headers: { 'X-Registration-Token': registrationToken },
      });
      return res.data;
    },
    onSuccess: async () => {
      setStep('DOCUMENTS_UPLOAD');
      await saveSession('DOCUMENTS_UPLOAD');
    },
    onError: (err: any) => {
      Alert.alert('Registration Error', apiErrorMessage(err, 'Failed to save profile details.'));
    },
  });

  const submitDocumentsMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      documents.forEach((doc) => {
        const extension = doc.fileName.split('.').pop()?.toLowerCase() || '';
        const mime =
          extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : 'image/jpeg';

        form.append('files', {
          uri: doc.fileUri,
          name: doc.fileName,
          type: mime,
        } as any);

        form.append('documentTypes', doc.type);
      });

      const res = await smartSkillsClient.post('/career-advisors/documents', form, {
        headers: {
          'X-Registration-Token': registrationToken,
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
      });
      return res.data;
    },
    onSuccess: async () => {
      await removeSecureItem(ADVISOR_REGISTER_SESSION);
      Alert.alert(
        'Registration Completed',
        'Your application has been submitted and is awaiting verification.',
        [{ text: 'Sign In', onPress: () => navigation.navigate('AdvisorLogin') }]
      );
    },
    onError: (err: any) => {
      Alert.alert('Document Submission Error', apiErrorMessage(err, 'Failed to complete registration.'));
    },
  });

  // Handlers
  const handleSendOtp = () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    sendOtpMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (!otpCode || otpCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-digit verification code.');
      return;
    }
    verifyOtpMutation.mutate();
  };

  const handleStateSelect = (stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedDistrict(null);
    setSelectedTerritory(null);
    setSelectedSector(null);
    setSelectedInstitute(null);
    setActiveModal(null);
  };

  const handleDistrictSelect = (district: any) => {
    setSelectedDistrict(district);
    setSelectedTerritory(null);
    setSelectedSector(null);
    setSelectedInstitute(null);
    setActiveModal(null);
  };

  const handleTerritorySelect = (territory: any) => {
    setSelectedTerritory(territory);
    setSelectedSector(null);
    setSelectedInstitute(null);
    setActiveModal(null);
  };

  const handleSectorSelect = (sector: any) => {
    setSelectedSector({
      id: sector.id,
      sectorId: sector.sectorId || sector.sector?.id,
      name: sector.sector?.name || sector.name,
    });
    setSelectedInstitute(null);
    setActiveModal(null);
  };

  const handleInstituteSelect = (inst: any) => {
    setSelectedInstitute(inst);
    setActiveModal(null);
  };

  const handleProfileSubmit = () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Missing Fields', 'Full name is required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!dob || Number.isNaN(Date.parse(dob))) {
      Alert.alert('Invalid Date', 'Enter date of birth as YYYY-MM-DD.');
      return;
    }
    if (!qualification.trim()) {
      Alert.alert('Missing Fields', 'Qualification is required.');
      return;
    }
    if (!address.trim() || address.trim().length < 5) {
      Alert.alert('Missing Fields', 'Residential address is required.');
      return;
    }
    if (!selectedInstitute) {
      Alert.alert('Missing Institute', 'Select a target institute to map your onboarding.');
      return;
    }
    if (!bankAccountHolder.trim()) {
      Alert.alert('Missing Settlement Info', 'Account holder name is required.');
      return;
    }
    if (bankAccountNumber.trim().length < 8) {
      Alert.alert('Missing Settlement Info', 'Enter a valid bank account number.');
      return;
    }
    const ifsc = bankIFSC.toUpperCase().trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      Alert.alert('Invalid IFSC', 'Enter a valid 11-character IFSC code.');
      return;
    }
    if (!bankName.trim()) {
      Alert.alert('Missing Settlement Info', 'Bank name is required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }

    profileRegisterMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone,
      dob: new Date(dob).toISOString(),
      gender,
      experienceYears: Number(experienceYears || 0),
      qualification: qualification.trim(),
      address: address.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankIFSC: ifsc,
      bankName: bankName.trim(),
      bankAccountHolder: bankAccountHolder.trim(),
      password,
      instituteId: selectedInstitute.id,
    });
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        const extension = picked.name.split('.').pop()?.toLowerCase() || '';
        if (!['pdf', 'png', 'jpg', 'jpeg'].includes(extension)) {
          Alert.alert('Unsupported File', 'Attach a PDF, PNG, or JPG document.');
          return;
        }
        const filtered = documents.filter((d) => d.type !== currentDocType);
        setDocuments([...filtered, { type: currentDocType, fileName: picked.name, fileUri: picked.uri }]);
      }
    } catch {
      Alert.alert('File Pick Error', 'Unable to select document.');
    }
  };

  const handleRemoveDocument = (docType: string) => {
    setDocuments(documents.filter((d) => d.type !== docType));
  };

  const handleFinalSubmit = () => {
    if (documents.length === 0) {
      Alert.alert('Missing Documents', 'Please attach at least one document before completing submission.');
      return;
    }
    submitDocumentsMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* NAVBAR HEADER */}
      <View style={styles.navbarHeader}>
        <TouchableOpacity style={styles.closeButtonAction} onPress={() => navigation.goBack()}>
          <Text style={styles.closeActionIconText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.navbarTitleText}>Career Advisor Onboarding</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* HEADER BADGE & DESCRIPTION */}
          <View style={styles.headerInfoBanner}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillIcon}>🛡️</Text>
              <Text style={styles.badgePillText}>ADVISOR ONBOARDING</Text>
            </View>
            <Text style={styles.screenMainTitle}>Career Advisor Registration</Text>
            <Text style={styles.screenMainSubtext}>
              {step === 'PHONE_OTP' && 'Verify your mobile and email credentials to initialize your onboarding node.'}
              {step === 'PROFILE_FORM' && 'Complete your personal, institutional, and settlement payout details.'}
              {step === 'DOCUMENTS_UPLOAD' && 'Upload mandatory verification documents to complete your registration.'}
            </Text>
          </View>

          {/* STEPPER CARDS (3 COLUMNS LIKE NEXT.JS) */}
          <View style={styles.stepperContainer}>
            <View
              style={[
                styles.stepBadgeBox,
                step === 'PHONE_OTP'
                  ? styles.stepBadgeActive
                  : styles.stepBadgeCompleted,
              ]}
            >
              <View
                style={[
                  styles.stepBadgeNumberCircle,
                  step !== 'PHONE_OTP' ? styles.stepBadgeCircleCompleted : styles.stepBadgeCircleActive,
                ]}
              >
                <Text style={styles.stepBadgeNumberText}>{step !== 'PHONE_OTP' ? '✓' : '1'}</Text>
              </View>
              <Text
                style={[
                  styles.stepBadgeLabel,
                  step === 'PHONE_OTP' ? styles.stepBadgeLabelActive : styles.stepBadgeLabelCompleted,
                ]}
                numberOfLines={1}
              >
                1. Verification
              </Text>
            </View>

            <View
              style={[
                styles.stepBadgeBox,
                step === 'PROFILE_FORM'
                  ? styles.stepBadgeActive
                  : step === 'DOCUMENTS_UPLOAD'
                  ? styles.stepBadgeCompleted
                  : styles.stepBadgeInactive,
              ]}
            >
              <View
                style={[
                  styles.stepBadgeNumberCircle,
                  step === 'DOCUMENTS_UPLOAD'
                    ? styles.stepBadgeCircleCompleted
                    : step === 'PROFILE_FORM'
                    ? styles.stepBadgeCircleActive
                    : styles.stepBadgeCircleInactive,
                ]}
              >
                <Text style={styles.stepBadgeNumberText}>{step === 'DOCUMENTS_UPLOAD' ? '✓' : '2'}</Text>
              </View>
              <Text
                style={[
                  styles.stepBadgeLabel,
                  step === 'PROFILE_FORM'
                    ? styles.stepBadgeLabelActive
                    : step === 'DOCUMENTS_UPLOAD'
                    ? styles.stepBadgeLabelCompleted
                    : styles.stepBadgeLabelInactive,
                ]}
                numberOfLines={1}
              >
                2. Profile
              </Text>
            </View>

            <View
              style={[
                styles.stepBadgeBox,
                step === 'DOCUMENTS_UPLOAD' ? styles.stepBadgeActive : styles.stepBadgeInactive,
              ]}
            >
              <View
                style={[
                  styles.stepBadgeNumberCircle,
                  step === 'DOCUMENTS_UPLOAD' ? styles.stepBadgeCircleActive : styles.stepBadgeCircleInactive,
                ]}
              >
                <Text style={styles.stepBadgeNumberText}>3</Text>
              </View>
              <Text
                style={[
                  styles.stepBadgeLabel,
                  step === 'DOCUMENTS_UPLOAD' ? styles.stepBadgeLabelActive : styles.stepBadgeLabelInactive,
                ]}
                numberOfLines={1}
              >
                3. Documents
              </Text>
            </View>
          </View>

          {/* STEP 1: PHONE & EMAIL VERIFICATION */}
          {step === 'PHONE_OTP' && (
            <View style={styles.cardSectionBox}>
              <Text style={styles.inputFieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.textInput}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!otpSent}
              />

              <Text style={styles.inputFieldLabel}>MOBILE PHONE NUMBER</Text>
              <View style={styles.inlineRowInputGroup}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="10-digit Indian mobile"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  editable={!otpSent}
                />
                <TouchableOpacity
                  style={[styles.inlineActionButton, otpSent && styles.inlineActionButtonOutline]}
                  onPress={handleSendOtp}
                  disabled={sendOtpMutation.isPending}
                >
                  {sendOtpMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.inlineActionButtonText, otpSent && styles.inlineActionButtonOutlineText]}>
                      {otpSent ? 'Resend OTP' : 'Send Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {otpSent && (
                <View style={styles.otpCardWrapper}>
                  <Text style={styles.otpCardTitle}>ENTER 6-DIGIT EMAIL VERIFICATION CODE</Text>
                  <TextInput
                    style={styles.otpTextInput}
                    placeholder="123456"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                  <Text style={styles.otpCardSubtext}>
                    Check your email inbox. The code is valid for 10 minutes.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryEmeraldButton}
                    onPress={handleVerifyOtp}
                    disabled={verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryActionButtonText}>Verify Code & Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* STEP 2: PROFILE & JURISDICTION CASCADE */}
          {step === 'PROFILE_FORM' && (
            <View style={{ gap: 16 }}>
              {/* INSTITUTIONAL MAPPING NODE */}
              <View style={styles.cardSectionBox}>
                <View style={styles.cardSectionHeaderRow}>
                  <Text style={styles.cardSectionHeaderTitle}>🏢 INSTITUTIONAL MAPPING NODE</Text>
                </View>

                {/* State Filter */}
                <Text style={styles.inputFieldLabel}>State Filter</Text>
                <TouchableOpacity style={styles.selectorDropdownButton} onPress={() => setActiveModal('STATE')}>
                  <Text style={styles.selectorDropdownButtonText}>
                    {rawStates.find((s: any) => s.id === selectedStateId)?.name || 'Select State'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* District */}
                <Text style={styles.inputFieldLabel}>District Jurisdiction *</Text>
                <TouchableOpacity
                  style={[styles.selectorDropdownButton, !selectedStateId && styles.disabledSelector]}
                  onPress={() => selectedStateId && setActiveModal('DISTRICT')}
                  disabled={!selectedStateId}
                >
                  <Text style={styles.selectorDropdownButtonText}>
                    {!selectedStateId
                      ? 'Select State First'
                      : loadingDistricts
                      ? 'Loading districts...'
                      : selectedDistrict
                      ? selectedDistrict.name
                      : rawDistricts.length === 0
                      ? 'No districts available'
                      : 'Select District'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* Territory */}
                <Text style={styles.inputFieldLabel}>Territory *</Text>
                <TouchableOpacity
                  style={[styles.selectorDropdownButton, !selectedDistrict && styles.disabledSelector]}
                  onPress={() => selectedDistrict && setActiveModal('TERRITORY')}
                  disabled={!selectedDistrict}
                >
                  <Text style={styles.selectorDropdownButtonText}>
                    {!selectedDistrict
                      ? 'Select District First'
                      : loadingTerritories
                      ? 'Loading territories...'
                      : selectedTerritory
                      ? `${selectedTerritory.name} (${selectedTerritory.code})`
                      : rawTerritories.length === 0
                      ? 'No territories available'
                      : 'Select Territory'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* Active Sector */}
                <Text style={styles.inputFieldLabel}>Sector *</Text>
                <TouchableOpacity
                  style={[styles.selectorDropdownButton, !selectedTerritory && styles.disabledSelector]}
                  onPress={() => selectedTerritory && setActiveModal('SECTOR')}
                  disabled={!selectedTerritory}
                >
                  <Text style={styles.selectorDropdownButtonText}>
                    {!selectedTerritory
                      ? 'Select Territory First'
                      : loadingSectors
                      ? 'Loading sectors...'
                      : selectedSector
                      ? selectedSector.name
                      : rawSectors.length === 0
                      ? 'No active sectors'
                      : 'Select Sector'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* Target Institute */}
                <Text style={styles.inputFieldLabel}>Target Institute *</Text>
                <TouchableOpacity
                  style={[styles.selectorDropdownButton, !selectedSector && styles.disabledSelector]}
                  onPress={() => selectedSector && setActiveModal('INSTITUTE')}
                  disabled={!selectedSector}
                >
                  <Text style={styles.selectorDropdownButtonText}>
                    {!selectedSector
                      ? 'Select Sector First'
                      : loadingInstitutes
                      ? 'Loading institutes...'
                      : selectedInstitute
                      ? `${selectedInstitute.name} ${selectedInstitute.code ? `(${selectedInstitute.code})` : ''}`
                      : selectableInstitutes.length === 0
                      ? 'No institutes mapped'
                      : 'Select Institute'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* PERSONAL IDENTITY */}
              <View style={styles.cardSectionBox}>
                <View style={styles.cardSectionHeaderRow}>
                  <Text style={styles.cardSectionHeaderTitle}>👤 PERSONAL IDENTITY</Text>
                </View>

                <Text style={styles.inputFieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.inputFieldLabel}>Email Address *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="john@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputFieldLabel}>Date of Birth *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={dob}
                      onChangeText={setDob}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>Gender *</Text>
                    <TouchableOpacity style={styles.selectorDropdownButton} onPress={() => setActiveModal('GENDER')}>
                      <Text style={styles.selectorDropdownButtonText}>{gender}</Text>
                      <Text style={styles.dropdownChevronText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputFieldLabel}>Field Experience (Yrs)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 5"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={experienceYears}
                      onChangeText={setExperienceYears}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>Highest Qualification *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. B.Tech / M.Sc"
                      placeholderTextColor="#94A3B8"
                      value={qualification}
                      onChangeText={setQualification}
                    />
                  </View>
                </View>

                <Text style={styles.inputFieldLabel}>Residential Address *</Text>
                <TextInput
                  style={[styles.textInput, { height: 76, textAlignVertical: 'top', paddingTop: 10 }]}
                  placeholder="Full residential address"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              {/* SETTLEMENT ACCOUNT PARAMETERS */}
              <View style={styles.cardSectionBox}>
                <View style={styles.cardSectionHeaderRow}>
                  <Text style={styles.cardSectionHeaderTitle}>💳 SETTLEMENT ACCOUNT PARAMETERS</Text>
                </View>

                <Text style={styles.inputFieldLabel}>Account Holder Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  value={bankAccountHolder}
                  onChangeText={setBankAccountHolder}
                />

                <Text style={styles.inputFieldLabel}>Account Number *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1234567890"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                />

                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputFieldLabel}>IFSC Code *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="SBIN0001234"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                      maxLength={11}
                      value={bankIFSC}
                      onChangeText={setBankIFSC}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>Bank Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="State Bank of India"
                      placeholderTextColor="#94A3B8"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                  </View>
                </View>
              </View>

              {/* ACCOUNT SECURITY */}
              <View style={styles.cardSectionBox}>
                <View style={styles.cardSectionHeaderRow}>
                  <Text style={styles.cardSectionHeaderTitle}>🔒 ACCOUNT SECURITY</Text>
                </View>

                <Text style={styles.inputFieldLabel}>Account Password *</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, borderBottomWidth: 1, borderWidth: 0 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggleAction}
                    onPress={() => setShowPassword((prev) => !prev)}
                  >
                    <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleProfileSubmit}
                disabled={profileRegisterMutation.isPending || !selectedInstitute}
              >
                {profileRegisterMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionButtonText}>Save Profile & Proceed to Documents →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: DOCUMENT UPLOAD */}
          {step === 'DOCUMENTS_UPLOAD' && (
            <View style={{ gap: 16 }}>
              <View style={styles.cardSectionBox}>
                <View style={styles.cardSectionHeaderRow}>
                  <Text style={styles.cardSectionHeaderTitle}>☁️ ATTACH VERIFICATION DOCUMENTS</Text>
                </View>

                <Text style={styles.inputFieldLabel}>Target Document Category</Text>
                <TouchableOpacity style={styles.selectorDropdownButton} onPress={() => setActiveModal('DOC_TYPE')}>
                  <Text style={styles.selectorDropdownButtonText}>
                    {DOCUMENT_TYPES.find((d) => d.value === currentDocType)?.label || currentDocType}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* DROP ZONE */}
                <TouchableOpacity style={styles.uploadDropZoneCard} onPress={handlePickDocument}>
                  <View style={styles.uploadCloudIconCircle}>
                    <Text style={{ fontSize: 22 }}>☁️</Text>
                  </View>
                  <Text style={styles.uploadZoneTitleText}>Tap to browse file from device</Text>
                  <Text style={styles.uploadZoneSubtext}>Supports PDF, PNG, JPG (Maximum size: 5MB)</Text>
                </TouchableOpacity>
              </View>

              {/* ATTACHED DOCUMENTS LIST */}
              <View style={{ marginTop: 8 }}>
                <Text style={styles.sectionSmallHeaderTitle}>
                  ATTACHED DOCUMENTS ({documents.length})
                </Text>

                {documents.length === 0 ? (
                  <View style={styles.emptyDocBox}>
                    <Text style={styles.emptyDocText}>
                      No documents attached yet. Drop files above to attach for verification.
                    </Text>
                  </View>
                ) : (
                  documents.map((doc) => {
                    const docLabel = DOCUMENT_TYPES.find((d) => d.value === doc.type)?.label || doc.type;
                    return (
                      <View key={doc.type} style={styles.docItemCardRow}>
                        <View style={styles.docIconBox}>
                          <Text style={{ fontSize: 16 }}>📄</Text>
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.docItemTitleText}>{docLabel}</Text>
                            <View style={styles.docTypeTagPill}>
                              <Text style={styles.docTypeTagPillText}>{doc.type}</Text>
                            </View>
                          </View>
                          <Text style={styles.docItemFilenameText} numberOfLines={1}>
                            {doc.fileName}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveDocument(doc.type)}>
                          <Text style={styles.removeDocActionText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryEmeraldButton, { marginTop: 12 }]}
                onPress={handleFinalSubmit}
                disabled={submitDocumentsMutation.isPending || documents.length === 0}
              >
                {submitDocumentsMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionButtonText}>Complete Onboarding & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* FOOTER */}
          <View style={styles.footerRedirectRow}>
            <Text style={styles.footerRedirectSubtext}>Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdvisorLogin')}>
              <Text style={styles.footerRedirectActionText}>Sign in here</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SELECTOR MODAL DIALOG */}
      <Modal visible={activeModal !== null} transparent animationType="slide">
        <View style={styles.modalBackdropOverlay}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitleText}>Select Option</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {activeModal === 'STATE' &&
                rawStates.map((st: any) => (
                  <TouchableOpacity
                    key={st.id || st.code}
                    style={styles.modalOptionRow}
                    onPress={() => handleStateSelect(st.id || st.code)}
                  >
                    <Text style={styles.modalOptionText}>{st.name}</Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'DISTRICT' &&
                rawDistricts.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalOptionRow}
                    onPress={() => handleDistrictSelect(item)}
                  >
                    <Text style={styles.modalOptionText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'TERRITORY' &&
                rawTerritories.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalOptionRow}
                    onPress={() => handleTerritorySelect(item)}
                  >
                    <Text style={styles.modalOptionText}>
                      {item.name} ({item.code})
                    </Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'SECTOR' &&
                rawSectors.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalOptionRow}
                    onPress={() => handleSectorSelect(item)}
                  >
                    <Text style={styles.modalOptionText}>
                      {item.name || item.sector?.name} ({item.code || item.sector?.code})
                    </Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'INSTITUTE' &&
                selectableInstitutes.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalOptionRow}
                    onPress={() => handleInstituteSelect(item)}
                  >
                    <Text style={styles.modalOptionText}>
                      {item.name} {item.code ? `(${item.code})` : ''}
                      {item.isSelfOperated ? ' [Self Institute]' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'GENDER' &&
                ['MALE', 'FEMALE', 'OTHER'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={styles.modalOptionRow}
                    onPress={() => {
                      setGender(g as any);
                      setActiveModal(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{g}</Text>
                  </TouchableOpacity>
                ))}

              {activeModal === 'DOC_TYPE' &&
                DOCUMENT_TYPES.map((dt) => (
                  <TouchableOpacity
                    key={dt.value}
                    style={styles.modalOptionRow}
                    onPress={() => {
                      setCurrentDocType(dt.value);
                      setActiveModal(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{dt.label}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  closeButtonAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeActionIconText: { fontSize: 16, color: '#0F172A', fontWeight: '400' },
  navbarTitleText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // HEADER BANNER
  headerInfoBanner: { marginBottom: 16 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgePillIcon: { fontSize: 10, marginRight: 4 },
  badgePillText: { fontSize: 10, fontWeight: '800', color: '#4338CA', letterSpacing: 0.5 },
  screenMainTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  screenMainSubtext: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },

  // STEPPER CARDS
  stepperContainer: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  stepBadgeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stepBadgeActive: { backgroundColor: '#EEF2FF', borderColor: '#818CF8' },
  stepBadgeCompleted: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  stepBadgeInactive: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },

  stepBadgeNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepBadgeCircleActive: { backgroundColor: '#4F46E5' },
  stepBadgeCircleCompleted: { backgroundColor: '#059669' },
  stepBadgeCircleInactive: { backgroundColor: '#94A3B8' },
  stepBadgeNumberText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  stepBadgeLabel: { fontSize: 11, fontWeight: '700', flex: 1 },
  stepBadgeLabelActive: { color: '#4F46E5' },
  stepBadgeLabelCompleted: { color: '#059669' },
  stepBadgeLabelInactive: { color: '#64748B' },

  // CARD CONTAINERS
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
  cardSectionHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  cardSectionHeaderTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },

  // INPUTS & DROPDOWNS
  inputFieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 10, marginBottom: 4, letterSpacing: 0.3 },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  selectorDropdownButton: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  disabledSelector: { backgroundColor: '#F1F5F9', opacity: 0.6 },
  selectorDropdownButtonText: { fontSize: 13, color: '#0F172A', flex: 1 },
  dropdownChevronText: { fontSize: 10, color: '#64748B', marginLeft: 6 },

  inlineRowInputGroup: { flexDirection: 'row', alignItems: 'center' },
  inlineActionButton: {
    backgroundColor: '#4F46E5',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  inlineActionButtonOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#4F46E5' },
  inlineActionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  inlineActionButtonOutlineText: { color: '#4F46E5' },

  // OTP CARD
  otpCardWrapper: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  otpCardTitle: { fontSize: 11, fontWeight: '800', color: '#0369A1', marginBottom: 8, letterSpacing: 0.3 },
  otpTextInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#0C4A6E',
  },
  otpCardSubtext: { fontSize: 11, color: '#0369A1', marginTop: 6, lineHeight: 16 },

  rowTwoInputs: { flexDirection: 'row', alignItems: 'center' },

  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  passwordToggleAction: { paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  passwordToggleText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },

  // BUTTONS
  primaryActionButton: {
    backgroundColor: '#4F46E5',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryEmeraldButton: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryActionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  // DROPZONE
  uploadDropZoneCard: {
    borderWidth: 2,
    borderColor: '#818CF8',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginTop: 10,
  },
  uploadCloudIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadZoneTitleText: { fontSize: 13, fontWeight: '700', color: '#1E1B4B' },
  uploadZoneSubtext: { fontSize: 11, color: '#64748B', marginTop: 2 },

  sectionSmallHeaderTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
  emptyDocBox: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyDocText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  docItemCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
  },
  docIconBox: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  docItemTitleText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  docTypeTagPill: { backgroundColor: '#EEF2FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  docTypeTagPillText: { fontSize: 9, fontWeight: '800', color: '#4F46E5' },
  docItemFilenameText: { fontSize: 10, color: '#64748B', marginTop: 2 },
  removeDocActionText: { fontSize: 14, padding: 4 },

  footerRedirectRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerRedirectSubtext: { fontSize: 13, color: '#64748B' },
  footerRedirectActionText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },

  // MODAL
  modalBackdropOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalSheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalHeaderTitleText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  modalCloseText: { fontSize: 16, color: '#0F172A' },
  modalOptionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalOptionText: { fontSize: 13, color: '#0F172A' },
});