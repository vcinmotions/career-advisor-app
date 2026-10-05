import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { mobileApiClient } from '../../api/mobileClient';
import { useAuthMock } from '../../context/AuthContext';

export default function AdvisorProfileScreen() {
  const { logout } = useAuthMock();
  const query = useQuery({
    queryKey: ['ca-profile'],
    queryFn: async () => (await mobileApiClient.get('/profile')).data?.data,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const profile = query.data || {};
  const rows = [
    ['Name', `${profile.firstName || ''} ${profile.lastName || ''}`.trim()],
    ['Role', profile.role],
    ['Mobile', profile.phone],
    ['Email', profile.email],
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>CA Profile</Text>
        <Text style={styles.hint}>Smart Skills fields are read-only on mobile.</Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value || '—'}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  hint: { color: '#64748B', marginBottom: 16, marginTop: 4 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  label: { color: '#64748B', fontSize: 12 },
  value: { color: '#0F172A', fontSize: 15, fontWeight: '600', marginTop: 2 },
  logout: { marginTop: 24, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '700' },
});
