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

// Same document categories as the web Career Advisor registration.
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

  // Step 1 State: Email OTP
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registrationToken, setRegistrationToken] = useState('');

  // Step 2 State: Profile Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [experienceYears, setExperienceYears] = useState('0');
  const [qualification, setQualification] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 State: Bank Details
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIFSC, setBankIFSC] = useState('');
  const [bankName, setBankName] = useState('');

  // Jurisdiction Cascading State (Use IDs for filters)
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<{ id: string; name: string } | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<{ id: string; name: string; code: string } | null>(null);
  const [selectedSector, setSelectedSector] = useState<{ id: string; sectorId?: string; name: string } | null>(null);
  const [selectedInstitute, setSelectedInstitute] = useState<{ id: string; name: string; code?: string } | null>(null);

  // Active Selector Modal State
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

  // Public lookups. These routes do not require a login token.
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

  // ==========================================
  // MUTATIONS
  // ==========================================
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
      documents.forEach((doc, index) => {
        const extension = doc.fileName.split('.').pop()?.toLowerCase() || '';
        const mime =
          extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : 'image/jpeg';
        form.append('files', {
          uri: doc.fileUri,
          name: doc.fileName,
          type: mime,
        } as any);
        form.append(`documentTypes[${index}]`, doc.type);
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
        'Registration Submitted',
        'Your career advisor application has been submitted and is under verification.',
        [{ text: 'Log In Now', onPress: () => navigation.navigate('AdvisorLogin') }]
      );
    },
    onError: (err: any) => {
      Alert.alert('Document Submission Error', apiErrorMessage(err, 'Failed to complete registration.'));
    },
  });

  // ==========================================
  // HANDLERS & CASCADE SETTERS
  // ==========================================
  const handleSendOtp = () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address to receive the OTP.');
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
      Alert.alert('Missing Fields', 'Full name must be at least 2 characters.');
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
    if (!qualification.trim() || qualification.trim().length < 2) {
      Alert.alert('Missing Fields', 'Highest qualification is required.');
      return;
    }
    if (!address.trim() || address.trim().length < 5) {
      Alert.alert('Missing Fields', 'Residential address is required.');
      return;
    }
    if (!selectedInstitute) {
      Alert.alert('Missing Institute', 'Select district, territory, sector, and institute.');
      return;
    }
    if (!bankAccountHolder.trim() || bankAccountHolder.trim().length < 2) {
      Alert.alert('Missing Payout Details', 'Account holder name is required.');
      return;
    }
    if (bankAccountNumber.trim().length < 8) {
      Alert.alert('Missing Payout Details', 'Bank account number must be at least 8 characters.');
      return;
    }
    const ifsc = bankIFSC.toUpperCase().trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      Alert.alert('Invalid IFSC', 'Enter a valid 11-character IFSC code.');
      return;
    }
    if (!bankName.trim() || bankName.trim().length < 2) {
      Alert.alert('Missing Payout Details', 'Bank name is required.');
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
    } catch (err) {
      Alert.alert('File Pick Error', 'Unable to select document.');
    }
  };

  const handleRemoveDocument = (docType: string) => {
    setDocuments(documents.filter((d) => d.type !== docType));
  };

  const handleFinalSubmit = () => {
    if (documents.length === 0) {
      Alert.alert('Missing Verification Documents', 'Please attach at least one document before submitting.');
      return;
    }
    submitDocumentsMutation.mutate();
  };

  const progressWidth = step === 'PHONE_OTP' ? '33%' : step === 'PROFILE_FORM' ? '66%' : '100%';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER */}
      <View style={styles.navbarHeader}>
        <TouchableOpacity style={styles.closeButtonAction} onPress={() => navigation.goBack()}>
          <Text style={styles.closeActionIconText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.navbarTitleTextText}>Advisor Registration</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* STEP PROGRESS INDICATOR */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelsRow}>
              <Text style={[styles.stepLabelText, step === 'PHONE_OTP' && styles.stepLabelTextActive]}>1. OTP</Text>
              <Text style={[styles.stepLabelText, step === 'PROFILE_FORM' && styles.stepLabelTextActive]}>2. Profile</Text>
              <Text style={[styles.stepLabelText, step === 'DOCUMENTS_UPLOAD' && styles.stepLabelTextActive]}>3. Documents</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
          </View>

          {/* STEP 1: EMAIL OTP VERIFICATION */}
          {step === 'PHONE_OTP' && (
            <View style={styles.stepContainer}>
              <Text style={styles.sectionTitleText}>Email and Mobile Verification</Text>
              <Text style={styles.sectionSubtext}>
                Verify your mobile number and email to begin career advisor onboarding. The code is sent to your email.
              </Text>

              <Text style={styles.inputFieldLabel}>Mobile Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="10-digit Indian mobile"
                placeholderTextColor="#6A6F73"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                editable={!otpSent}
              />

              <Text style={styles.inputFieldLabel}>Official Email Id *</Text>
              <View style={styles.inlineRowInputGroup}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Enter Email Address"
                  placeholderTextColor="#6A6F73"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
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
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {otpSent && (
                <View style={styles.otpInputGroupWrapper}>
                  <Text style={styles.inputFieldLabel}>6-Digit Email Verification Code</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#6A6F73"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />

                  <TouchableOpacity
                    style={styles.primaryActionButton}
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
            <View style={styles.stepContainer}>
              {/* INSTITUTIONAL JURISDICTION CASCADE */}
              <View style={styles.cardBoxWrapper}>
                <Text style={styles.cardBoxHeaderTitle}>Jurisdiction Cascade & Institution Assignment</Text>

                {/* 1. State Filter */}
                <Text style={styles.inputFieldLabel}>State Filter</Text>
                <TouchableOpacity style={styles.selectorDropdownButton} onPress={() => setActiveModal('STATE')}>
                  <Text style={styles.selectorDropdownButtonText}>
                    {rawStates.find((s: any) => s.id === selectedStateId)?.name || 'Select State'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* 2. District */}
                <Text style={styles.inputFieldLabel}>District *</Text>
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

                {/* 3. Territory */}
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

                {/* 4. Active Sector */}
                <Text style={styles.inputFieldLabel}>Active Sector *</Text>
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
                      : 'Select Active Sector'}
                  </Text>
                  <Text style={styles.dropdownChevronText}>▼</Text>
                </TouchableOpacity>

                {/* 5. Target Institute */}
                <Text style={styles.inputFieldLabel}>Target Institute *</Text>
                <TouchableOpacity
                  style={[styles.selectorDropdownButton, !selectedSector && styles.disabledSelector]}
                  onPress={() => selectedSector && setActiveModal('INSTITUTE')}
                  disabled={!selectedSector}
                >
                  <Text style={styles.selectorDropdownButtonText}>
                    {!selectedSector
                      ? 'Select Active Sector First'
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

              {/* PERSONAL DETAILS */}
              <Text style={styles.sectionTitleText}>Personal Details</Text>

              <Text style={styles.inputFieldLabel}>Full Name *</Text>
              <TextInput style={styles.textInput} placeholder="Jane Doe" placeholderTextColor="#6A6F73" value={name} onChangeText={setName} />

              <Text style={styles.inputFieldLabel}>Registered Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="advisor@domain.com"
                placeholderTextColor="#6A6F73"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.inputFieldLabel}>Verified Mobile Phone No.</Text>
              <TextInput style={[styles.textInput, styles.disabledSelector]} value={phone} editable={false} />

              <View style={styles.rowTwoInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputFieldLabel}>Date of Birth *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6A6F73"
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
                  <Text style={styles.inputFieldLabel}>Experience (Yrs)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 5"
                    placeholderTextColor="#6A6F73"
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
                    placeholderTextColor="#6A6F73"
                    value={qualification}
                    onChangeText={setQualification}
                  />
                </View>
              </View>

              <Text style={styles.inputFieldLabel}>Residential Address *</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Full residential address"
                placeholderTextColor="#6A6F73"
                multiline
                value={address}
                onChangeText={setAddress}
              />

              {/* BANK DETAILS */}
              <View style={[styles.cardBoxWrapper, { marginTop: 16 }]}>
                <Text style={styles.cardBoxHeaderTitle}>Bank Account Details (Payout Routing)</Text>

                <Text style={styles.inputFieldLabel}>Account Holder *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Jane Doe"
                  placeholderTextColor="#6A6F73"
                  value={bankAccountHolder}
                  onChangeText={setBankAccountHolder}
                />

                <Text style={styles.inputFieldLabel}>Account Number *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1234567890"
                  placeholderTextColor="#6A6F73"
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
                      placeholderTextColor="#6A6F73"
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
                      placeholderTextColor="#6A6F73"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                  </View>
                </View>
              </View>

              {/* SECURITY PASSWORD */}
              <Text style={styles.inputFieldLabel}>Temporary Account Password *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#6A6F73"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleProfileSubmit}
                disabled={profileRegisterMutation.isPending}
              >
                {profileRegisterMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionButtonText}>Save Profile & Proceed to Documents</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: DOCUMENT UPLOAD */}
          {step === 'DOCUMENTS_UPLOAD' && (
            <View style={styles.stepContainer}>
              <Text style={styles.sectionTitleText}>Verification Documents</Text>
              <Text style={styles.sectionSubtext}>Attach official documents to verify your credentials.</Text>

              <Text style={styles.inputFieldLabel}>Select Document Type</Text>
              <TouchableOpacity style={styles.selectorDropdownButton} onPress={() => setActiveModal('DOC_TYPE')}>
                <Text style={styles.selectorDropdownButtonText}>
                  {DOCUMENT_TYPES.find((d) => d.value === currentDocType)?.label || currentDocType}
                </Text>
                <Text style={styles.dropdownChevronText}>▼</Text>
              </TouchableOpacity>

              {/* FILE PICKER CARD */}
              <TouchableOpacity style={styles.uploadDropZoneCard} onPress={handlePickDocument}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
                <Text style={styles.uploadZoneTitleText}>Tap to pick file from device</Text>
                <Text style={styles.uploadZoneSubtext}>Supports PDF, PNG, JPG (Max 5MB)</Text>
              </TouchableOpacity>

              {/* ATTACHED DOCUMENTS LIST */}
              <Text style={[styles.sectionTitleText, { fontSize: 15, marginTop: 24 }]}>
                Attached Documents ({documents.length})
              </Text>

              {documents.length === 0 ? (
                <View style={styles.emptyDocBox}>
                  <Text style={styles.emptyDocText}>No documents attached yet.</Text>
                </View>
              ) : (
                documents.map((doc) => {
                  const docLabel = DOCUMENT_TYPES.find((d) => d.value === doc.type)?.label || doc.type;
                  return (
                    <View key={doc.type} style={styles.docItemCardRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.docItemTitleText}>{docLabel}</Text>
                        <Text style={styles.docItemFilenameText} numberOfLines={1}>
                          {doc.fileName}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveDocument(doc.type)}>
                        <Text style={styles.removeDocActionText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={[styles.primaryActionButton, { marginTop: 24 }]}
                onPress={handleFinalSubmit}
                disabled={submitDocumentsMutation.isPending || documents.length === 0}
              >
                {submitDocumentsMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionButtonText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* FOOTER LINK */}
          <View style={styles.footerRedirectRow}>
            <Text style={styles.footerRedirectSubtext}>Already registered?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdvisorLogin')}>
              <Text style={styles.footerRedirectActionText}> Log in</Text>
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

            <ScrollView style={{ maxHeight: 350 }}>
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  navbarHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  closeButtonAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeActionIconText: { fontSize: 16, color: '#1C1D1F', fontWeight: '300' },
  navbarTitleTextText: { fontSize: 15, fontWeight: '700', color: '#1C1D1F' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  progressSection: { marginBottom: 24 },
  progressLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepLabelText: { fontSize: 12, fontWeight: '600', color: '#6A6F73' },
  stepLabelTextActive: { color: '#4F46E5', fontWeight: '800' },
  progressBarTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4F46E5' },

  stepContainer: { flex: 1 },
  sectionTitleText: { fontSize: 18, fontWeight: '800', color: '#1C1D1F', marginBottom: 4 },
  sectionSubtext: { fontSize: 13, color: '#6A6F73', marginBottom: 20, lineHeight: 18 },

  inputFieldLabel: { fontSize: 13, fontWeight: '700', color: '#1C1D1F', marginTop: 12, marginBottom: 6 },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D7DC',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1C1D1F',
    backgroundColor: '#FFFFFF',
  },

  inlineRowInputGroup: { flexDirection: 'row', alignItems: 'center' },
  inlineActionButton: {
    backgroundColor: '#4F46E5',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  inlineActionButtonOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#4F46E5' },
  inlineActionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  inlineActionButtonOutlineText: { color: '#4F46E5' },

  otpInputGroupWrapper: { marginTop: 16 },

  primaryActionButton: {
    backgroundColor: '#4F46E5',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryActionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  cardBoxWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardBoxHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: 8 },

  selectorDropdownButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D7DC',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  disabledSelector: { backgroundColor: '#F1F5F9', opacity: 0.6 },
  selectorDropdownButtonText: { fontSize: 14, color: '#1C1D1F' },
  dropdownChevronText: { fontSize: 10, color: '#6A6F73' },

  rowTwoInputs: { flexDirection: 'row', alignItems: 'center' },

  uploadDropZoneCard: {
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginTop: 12,
  },
  uploadZoneTitleText: { fontSize: 14, fontWeight: '700', color: '#1C1D1F' },
  uploadZoneSubtext: { fontSize: 11, color: '#6A6F73', marginTop: 4 },

  emptyDocBox: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', marginTop: 8 },
  emptyDocText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  docItemCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  docItemTitleText: { fontSize: 13, fontWeight: '700', color: '#1C1D1F' },
  docItemFilenameText: { fontSize: 11, color: '#6A6F73', marginTop: 2 },
  removeDocActionText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },

  footerRedirectRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerRedirectSubtext: { fontSize: 14, color: '#1C1D1F' },
  footerRedirectActionText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },

  modalBackdropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalHeaderTitleText: { fontSize: 16, fontWeight: '700', color: '#1C1D1F' },
  modalCloseText: { fontSize: 18, color: '#1C1D1F' },
  modalOptionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalOptionText: { fontSize: 14, color: '#1C1D1F' },
});