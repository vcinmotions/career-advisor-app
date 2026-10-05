import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { apiErrorMessage, smartSkillsClient, unwrapList } from '../../api/smartSkillsClient';

const today = () => new Date().toISOString().slice(0, 10);

export default function AdvisorPurchaseOrdersScreen() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [subGroupId, setSubGroupId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentReference, setPaymentReference] = useState('');
  const [message, setMessage] = useState('');
  const [proof, setProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['advisor-purchase-orders'],
    queryFn: async () => (await smartSkillsClient.get('/purchase-orders', { params: { page: 1, limit: 50, scope: 'mine' } })).data?.data,
  });
  const groupsQuery = useQuery({
    queryKey: ['advisor-purchase-order-groups'],
    queryFn: async () => unwrapList((await smartSkillsClient.get('/coupon-groups')).data),
    enabled: showCreate,
  });
  const groups = (groupsQuery.data || []).filter((item: any) => item.isActive !== false);
  const selectedGroup = groups.find((item: any) => item.id === groupId);
  const subGroups = useMemo(() => (selectedGroup?.subGroups || []).filter((item: any) => item.isActive !== false), [selectedGroup]);
  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : ordersQuery.data?.items || ordersQuery.data?.purchaseOrders || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !subGroupId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) throw new Error('Select a product group, sub-group, and quantity of at least 1.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('Enter the payment date as YYYY-MM-DD.');
      const form = new FormData();
      form.append('items', JSON.stringify([{ couponGroupId: groupId, couponSubGroupId: subGroupId, quantityAsked: Number(quantity) }]));
      form.append('recipientType', 'ADMIN');
      form.append('paymentDate', paymentDate);
      if (paymentReference.trim()) form.append('paymentReference', paymentReference.trim());
      if (message.trim()) form.append('message', message.trim());
      if (proof) form.append('paymentProof', { uri: proof.uri, name: proof.name || 'payment-proof', type: proof.mimeType || 'application/octet-stream' } as any);
      return smartSkillsClient.post('/purchase-orders', form, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: (data) => data });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['advisor-purchase-orders'] });
      setShowCreate(false); setGroupId(''); setSubGroupId(''); setQuantity('1'); setPaymentDate(today()); setPaymentReference(''); setMessage(''); setProof(null);
      Alert.alert('Purchase order raised', 'Your request was sent to Admin for review.');
    },
    onError: (error: any) => Alert.alert('Could not raise purchase order', apiErrorMessage(error, error?.message || 'Please check the order details.')),
  });

  const chooseProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/pdf', 'image/*'] });
    if (!result.canceled) setProof(result.assets[0]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Purchase orders</Text><TouchableOpacity style={styles.button} onPress={() => setShowCreate(true)}><Text style={styles.buttonText}>+ Raise PO</Text></TouchableOpacity></View>
      {ordersQuery.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} color="#4F46E5" /> : (
        <FlatList data={orders} keyExtractor={(item: any, index) => String(item.id || index)} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={styles.muted}>No purchase orders yet.</Text>} renderItem={({ item }: any) => (
          <View style={styles.card}><Text style={styles.cardTitle}>{item.poNumber || 'Purchase order'}</Text><Text style={styles.muted}>Status: {String(item.status || '—').replace(/_/g, ' ')}</Text><Text style={styles.muted}>Created: {item.createdAt ? String(item.createdAt).slice(0, 10) : '—'}</Text><Text style={styles.muted}>Quantity: {item.quantityAsked ?? item.items?.reduce?.((sum: number, line: any) => sum + Number(line.quantityAsked || 0), 0) ?? '—'}</Text></View>
        )} />
      )}
      {ordersQuery.isError && <Text style={styles.error}>Could not load purchase orders. Pull down to retry.</Text>}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Raise purchase order</Text><Text style={styles.muted}>Orders are sent to Admin for accounts review.</Text>
          <Text style={styles.label}>Product group</Text>{groupsQuery.isLoading ? <ActivityIndicator color="#4F46E5" /> : groups.map((group: any) => <TouchableOpacity key={group.id} style={[styles.choice, groupId === group.id && styles.choiceActive]} onPress={() => { setGroupId(group.id); setSubGroupId(''); }}><Text style={styles.choiceText}>{group.name}</Text></TouchableOpacity>)}
          {!!groupId && <><Text style={styles.label}>Product sub-group</Text>{subGroups.map((item: any) => <TouchableOpacity key={item.id} style={[styles.choice, subGroupId === item.id && styles.choiceActive]} onPress={() => setSubGroupId(item.id)}><Text style={styles.choiceText}>{item.name}</Text></TouchableOpacity>)}</>}
          <Text style={styles.label}>Quantity</Text><TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <Text style={styles.label}>Payment date (YYYY-MM-DD)</Text><TextInput style={styles.input} value={paymentDate} onChangeText={setPaymentDate} placeholder="2026-10-05" />
          <Text style={styles.label}>Payment reference</Text><TextInput style={styles.input} value={paymentReference} onChangeText={setPaymentReference} />
          <Text style={styles.label}>Message (optional)</Text><TextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} multiline maxLength={1000} />
          <TouchableOpacity style={styles.secondaryButton} onPress={chooseProof}><Text style={styles.secondaryText}>{proof?.name || 'Attach payment proof (optional)'}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.submit]} disabled={createMutation.isPending} onPress={() => createMutation.mutate()}>{createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit purchase order</Text>}</TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={() => setShowCreate(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </ScrollView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F8FAFC' }, header: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 21, fontWeight: '800', color: '#0F172A' }, button: { backgroundColor: '#4F46E5', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 9 }, buttonText: { color: '#fff', fontWeight: '700' }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginBottom: 10 }, cardTitle: { fontWeight: '700', color: '#0F172A', marginBottom: 5 }, muted: { color: '#64748B', marginTop: 5 }, error: { color: '#B91C1C', padding: 16 }, form: { padding: 20, paddingBottom: 36 }, label: { fontWeight: '700', color: '#334155', marginTop: 16, marginBottom: 6 }, choice: { borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 8, marginBottom: 7, backgroundColor: '#fff' }, choiceActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' }, choiceText: { color: '#1E293B' }, input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, minHeight: 46, backgroundColor: '#fff', color: '#0F172A' }, multiline: { minHeight: 84, textAlignVertical: 'top', paddingTop: 10 }, secondaryButton: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 13 }, secondaryText: { color: '#334155' }, submit: { marginTop: 16, alignItems: 'center' }, cancel: { padding: 14, alignItems: 'center' }, cancelText: { color: '#B91C1C', fontWeight: '700' } });
