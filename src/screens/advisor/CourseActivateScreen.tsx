import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateCourseWithCoupon } from '../../api/mobileClient';

function newIdempotencyKey() {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CourseActivateScreen({ route, navigation }: any) {
  const learningCourseId = route.params?.learningCourseId || route.params?.id;
  const [couponCode, setCouponCode] = useState('');
  const [pending, setPending] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());

  const activate = async () => {
    if (!learningCourseId || !couponCode.trim()) {
      Alert.alert('Required', 'Enter a coupon code.');
      return;
    }
    setPending(true);
    try {
      const response = await activateCourseWithCoupon({
        learningCourseId,
        couponCode: couponCode.trim(),
        idempotencyKey: idempotencyKey.current,
      });
      Alert.alert('Activation', response.data?.data?.status === 'ENROLLED' ? 'Course activated.' : `Status: ${response.data?.data?.status}`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Activation failed', error?.response?.data?.message || error?.response?.data?.error || 'Smart Skills rejected this coupon.');
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <Text style={styles.title}>Activate course</Text>
        <Text style={styles.hint}>Coupon group matching, TSO selection, commission and eligibility are decided by Smart Skills.</Text>
        <TextInput
          style={styles.input}
          placeholder="Coupon code"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
          value={couponCode}
          onChangeText={setCouponCode}
        />
        <TouchableOpacity style={styles.button} onPress={activate} disabled={pending}>
          {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Activate</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  hint: { color: '#64748B', marginVertical: 12 },
  input: { height: 50, borderWidth: 1, borderColor: '#1C1D1F', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16 },
  button: { height: 48, backgroundColor: '#4F46E5', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
