import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import { useAuthMock } from '../../context/AuthContext';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? '—'}</Text>
    </View>
  );
}

export default function AdvisorDashboardScreen({ navigation }: any) {
  const { user } = useAuthMock();
  const query = useQuery({
    queryKey: ['ca-dashboard', user?.id],
    queryFn: async () => (await mobileApiClient.get('/lms/me/overview')).data?.data,
    enabled: Boolean(user?.id),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const data = query.data || {};
  const stages = data.stages || [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}>
        <Text style={styles.title}>Career Advisor</Text>
        <Text style={styles.subtitle}>{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || user?.email}</Text>

        <Card title="Profile">
          <Row label="Account" value={user?.email} />
          <Row label="Career advisor status" value={data.status} />
        </Card>

        <Card title="CA Progress">
          {stages.map((stage: any) => <Row key={stage.key} label={String(stage.key).replace(/_/g, ' ')} value={stage.complete ? 'Complete' : 'In progress'} />)}
          <Row label="Coupon sales target" value={data.couponSelling?.complete ? 'Complete' : `${data.couponSelling?.redeemed ?? 0} / ${data.couponSelling?.required ?? 0}`} />
        </Card>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AdvisorOrientation')}>
          <Text style={styles.buttonText}>Open CA Journey</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', paddingHorizontal: 20, paddingTop: 16 },
  subtitle: { fontSize: 14, color: '#64748B', paddingHorizontal: 20, marginBottom: 12 },
  card: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#4F46E5', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 12 },
  label: { color: '#64748B', fontSize: 13 },
  value: { color: '#0F172A', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  button: { margin: 16, backgroundColor: '#4F46E5', height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
