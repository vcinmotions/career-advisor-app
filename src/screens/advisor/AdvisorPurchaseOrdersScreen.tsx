import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { apiErrorMessage, smartSkillsClient, unwrapList } from '../../api/smartSkillsClient';
import { Ionicons } from '@expo/vector-icons';

const today = () => new Date().toISOString().slice(0, 10);

type PoLineDraft = {
  key: string;
  couponGroupId: string;
  couponSubGroupId: string;
  quantityAsked: string;
};

function newLine(): PoLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    couponGroupId: '',
    couponSubGroupId: '',
    quantityAsked: '1',
  };
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#D97706' },
  ACCOUNTS_APPROVED: { bg: '#E0F2FE', text: '#0284C7' },
  ACCOUNTS_REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  COUPONS_ASSIGNED: { bg: '#D1FAE5', text: '#059669' },
  UNDER_PROCESS: { bg: '#E0E7FF', text: '#4F46E5' },
  DISPATCHED: { bg: '#EDE9FE', text: '#7C3AED' },
  DELIVERED: { bg: '#D1FAE5', text: '#059669' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  CANCELLED: { bg: '#F1F5F9', text: '#64748B' },
};

export default function AdvisorPurchaseOrdersScreen() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Form States for Modal
  const [lines, setLines] = useState<PoLineDraft[]>([newLine()]);
  const [recipientType, setRecipientType] = useState<'ADMIN' | 'TSO' | 'INSTITUTE' | 'CA'>('ADMIN');
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentReference, setPaymentReference] = useState('');
  const [message, setMessage] = useState('');
  const [proof, setProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Dropdown Picker Modal States
  const [activePickerLineKey, setActivePickerLineKey] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'GROUP' | 'SUBGROUP' | null>(null);

  // Queries
  const ordersQuery = useQuery({
    queryKey: ['advisor-purchase-orders'],
    queryFn: async () =>
      (
        await smartSkillsClient.get('/purchase-orders', {
          params: { page: 1, limit: 50, scope: 'mine' },
        })
      ).data?.data,
  });

  const groupsQuery = useQuery({
    queryKey: ['advisor-purchase-order-groups'],
    queryFn: async () => unwrapList((await smartSkillsClient.get('/coupon-groups')).data),
    enabled: showCreate,
  });

  const groups = (groupsQuery.data || []).filter((item: any) => item.isActive !== false);

  const orders = Array.isArray(ordersQuery.data)
    ? ordersQuery.data
    : ordersQuery.data?.items || ordersQuery.data?.purchaseOrders || [];

  const handleRefresh = () => {
    ordersQuery.refetch();
  };

  // Create PO Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const items = [];
      for (const [index, line] of lines.entries()) {
        if (!line.couponGroupId) throw new Error(`Select a product group for line ${index + 1}.`);
        if (!line.couponSubGroupId) throw new Error(`Select a product sub-group for line ${index + 1}.`);
        const qty = parseInt(line.quantityAsked, 10);
        if (!Number.isInteger(qty) || qty < 1) throw new Error(`Enter a quantity of at least 1 for line ${index + 1}.`);
        items.push({
          couponGroupId: line.couponGroupId,
          couponSubGroupId: line.couponSubGroupId,
          quantityAsked: qty,
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('Enter the payment date as YYYY-MM-DD.');

      const form = new FormData();
      form.append('items', JSON.stringify(items));
      form.append('recipientType', recipientType);
      form.append('paymentDate', paymentDate);
      if (paymentReference.trim()) form.append('paymentReference', paymentReference.trim());
      if (message.trim()) form.append('message', message.trim());
      if (proof) {
        form.append('paymentProof', {
          uri: proof.uri,
          name: proof.name || 'payment-proof',
          type: proof.mimeType || 'application/octet-stream',
        } as any);
      }

      return smartSkillsClient.post('/purchase-orders', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['advisor-purchase-orders'] });
      setShowCreate(false);
      setLines([newLine()]);
      setRecipientType('ADMIN');
      setPaymentDate(today());
      setPaymentReference('');
      setMessage('');
      setProof(null);
      Alert.alert('Purchase Order Raised 🎉', 'Your request was sent to Accounts for review.');
    },
    onError: (error: any) =>
      Alert.alert(
        'Could not raise purchase order',
        apiErrorMessage(error, error?.message || 'Please check the order details.')
      ),
  });

  const chooseProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });
    if (!result.canceled) setProof(result.assets[0]);
  };

  const updateLine = (key: string, patch: Partial<PoLineDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.mainScrollView}
        refreshControl={
          <RefreshControl refreshing={ordersQuery.isFetching} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
      >
        {/* ─── HERO BANNER ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBanner}>
            <View style={styles.heroDecorationRight} />
            <View style={styles.heroDecorationLeft} />

            <View style={styles.zIndexHigh}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>📜 PURCHASE ORDER CONSOLE</Text>
              </View>
              <Text style={styles.heroTitle}>Coupon Stock Requisitions</Text>
              <Text style={styles.heroSubtitle}>
                Raise purchase orders for starter kits and coupon stock, attach payment receipts, and track fulfillment status.
              </Text>
              <TouchableOpacity
                style={styles.heroButton}
                activeOpacity={0.8}
                onPress={() => setShowCreate(true)}
              >
                <Text style={styles.heroButtonText}>+ Raise Purchase Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── VALUE MATRIX TRUST BAR ─── */}
        {/* <View style={styles.trustSection}>
          <View style={styles.trustBar}>
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>🛡️</Text>
              <Text style={styles.trustText}>Accounts Vetted</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>⚡</Text>
              <Text style={styles.trustText}>Instant Codes</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>📜</Text>
              <Text style={styles.trustText}>Official Ledger</Text>
            </View>
          </View>
        </View> */}

        {/* ─── PURCHASE ORDERS LIST ─── */}
        <View style={styles.contentFeedSection}>
          <Text style={styles.sectionHeadingTextNoPadding}>My Raised Orders Queue</Text>

          {ordersQuery.isLoading ? (
            <View style={styles.centerLoadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>Syncing purchase order queue...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateEmoji}>📋</Text>
              <Text style={styles.emptyStateTitle}>No Purchase Orders Raised</Text>
              <Text style={styles.emptyStateDescription}>
                Tap the "+ Raise Purchase Order" button above to request coupon stock.
              </Text>
            </View>
          ) : (
            orders.map((item: any, index: number) => {
              const statusStyle = STATUS_STYLES[item.status] || { bg: '#F1F5F9', text: '#64748B' };
              const quantityAsked =
                item.quantityAsked ??
                item.items?.reduce?.((sum: number, line: any) => sum + Number(line.quantityAsked || 0), 0) ??
                '—';

              return (
                <View key={String(item.id || index)} style={styles.premiumCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.poNumberText}>{item.poNumber || 'Purchase Order'}</Text>
                      <Text style={styles.poSubtext}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadgePill, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                        {String(item.status || 'PENDING').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetailRow}>
                    <Text style={styles.detailLabel}>Quantity Requisitioned:</Text>
                    <Text style={styles.detailValueBold}>{quantityAsked} Unit(s)</Text>
                  </View>

                  {item.paymentReference ? (
                    <View style={styles.cardDetailRow}>
                      <Text style={styles.detailLabel}>Payment Ref / UTR:</Text>
                      <Text style={styles.detailValueMono}>{item.paymentReference}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* ─── FOOTER CTA BANNER ─── */}
        <View style={styles.ctaSection}>
          <View style={styles.ctaBanner}>
            <View style={styles.ctaDecorationCircle} />
            <Text style={styles.ctaTitle}>Accounts & Inventory Support</Text>
            <Text style={styles.ctaDescription}>
              Need assistance with payment verification or stock dispatch? Reach out to central accounts.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={() => setShowCreate(true)}
            >
              <Text style={styles.ctaButtonText}>Raise Order Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ─── CREATE PURCHASE ORDER MODAL ─── */}
      <Modal visible={showCreate} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Raise Purchase Order</Text>
                <Text style={styles.modalSubtitle}>Orders are routed to Accounts for review.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* RECIPIENT TARGET */}
            <Text style={styles.label}>Order Recipient Target *</Text>
            <View style={styles.recipientGridRow}>
              {[
                ['ADMIN', 'Central Admin'],
                ['TSO', 'TSO Owner'],
                ['INSTITUTE', 'Institute'],
              ].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.recipientChip, recipientType === key && styles.recipientChipActive]}
                  onPress={() => setRecipientType(key as any)}
                >
                  <Text
                    style={[styles.recipientChipText, recipientType === key && styles.recipientChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* PRODUCT LINES */}
            <Text style={styles.label}>Product Lines *</Text>
            {lines.map((line, idx) => {
              const selectedGrp = groups.find((g: any) => g.id === line.couponGroupId);
              const subGrpList = (selectedGrp?.subGroups || []).filter((s: any) => s.isActive !== false);
              const selectedSubGrp = subGrpList.find((s: any) => s.id === line.couponSubGroupId);

              return (
                <View key={line.key} style={styles.lineCardBox}>
                  <View style={styles.lineCardHeader}>
                    <Text style={styles.lineTitle}>Line {idx + 1}</Text>
                    {lines.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setLines((prev) => prev.filter((item) => item.key !== line.key))}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Product Group Selector Trigger */}
                  <Text style={styles.innerLabel}>Product Group *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTriggerBtn}
                    onPress={() => {
                      setActivePickerLineKey(line.key);
                      setPickerMode('GROUP');
                    }}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {selectedGrp?.name || '-- Select Product Group --'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>

                  {/* Product Sub-Group Selector Trigger */}
                  {line.couponGroupId ? (
                    <>
                      <Text style={styles.innerLabel}>Product Sub-Group *</Text>
                      <TouchableOpacity
                        style={styles.dropdownTriggerBtn}
                        onPress={() => {
                          setActivePickerLineKey(line.key);
                          setPickerMode('SUBGROUP');
                        }}
                      >
                        <Text style={styles.dropdownTriggerText}>
                          {selectedSubGrp
                            ? `${selectedSubGrp.name} (${selectedSubGrp.code || 'Code'})`
                            : '-- Select Product Sub-Group --'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#64748B" />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <Text style={styles.innerLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    value={line.quantityAsked}
                    onChangeText={(v) => updateLine(line.key, { quantityAsked: v })}
                    keyboardType="number-pad"
                  />
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.outlineAddLineBtn}
              onPress={() => setLines((prev) => [...prev, newLine()])}
            >
              <Ionicons name="add-circle-outline" size={18} color="#4F46E5" style={{ marginRight: 6 }} />
              <Text style={styles.outlineAddLineText}>Add Another Product Line</Text>
            </TouchableOpacity>

            {/* PAYMENT DETAILS */}
            <Text style={styles.label}>Payment Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>UPI / Cheque / NEFT / Transaction Ref No.</Text>
            <TextInput
              style={styles.input}
              value={paymentReference}
              onChangeText={setPaymentReference}
              placeholder="UPI ref, cheque number or UTR"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Message / Remarks (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Notes for accounts team..."
              placeholderTextColor="#94A3B8"
            />

            {/* <Text style={styles.label}>Attach Payment Proof Document</Text>
            <TouchableOpacity style={styles.documentPickerBtn} onPress={chooseProof}>
              <Ionicons name="cloud-upload-outline" size={20} color="#4F46E5" style={{ marginRight: 8 }} />
              <Text style={styles.documentPickerText} numberOfLines={1}>
                {proof?.name || 'Upload Payment Receipt (PDF / Image)'}
              </Text>
            </TouchableOpacity> */}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Purchase Order →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── GROUP / SUBGROUP PICKER DIALOG MODAL ─── */}
      <Modal visible={!!pickerMode} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {pickerMode === 'GROUP' ? 'Select Product Group' : 'Select Product Sub-Group'}
              </Text>
              <TouchableOpacity onPress={() => setPickerMode(null)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {pickerMode === 'GROUP' &&
                groups.map((group: any) => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.pickerOptionRow}
                    onPress={() => {
                      if (activePickerLineKey) {
                        updateLine(activePickerLineKey, {
                          couponGroupId: group.id,
                          couponSubGroupId: '',
                        });
                      }
                      setPickerMode(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>{group.name}</Text>
                  </TouchableOpacity>
                ))}

              {pickerMode === 'SUBGROUP' &&
                (() => {
                  const currentLine = lines.find((l) => l.key === activePickerLineKey);
                  const selectedGrp = groups.find((g: any) => g.id === currentLine?.couponGroupId);
                  const subGrpList = (selectedGrp?.subGroups || []).filter((s: any) => s.isActive !== false);

                  return subGrpList.map((sub: any) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={styles.pickerOptionRow}
                      onPress={() => {
                        if (activePickerLineKey) {
                          updateLine(activePickerLineKey, { couponSubGroupId: sub.id });
                        }
                        setPickerMode(null);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>
                        {sub.name} {sub.code ? `(${sub.code})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ));
                })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // CORE BACKGROUND CONTEXTS
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  mainScrollView: { flex: 1, backgroundColor: '#FFFFFF' },
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

  // FEED & CARDS
  contentFeedSection: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  sectionHeadingTextNoPadding: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12, letterSpacing: -0.3 },

  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  poNumberText: { fontSize: 15, fontWeight: '800', color: '#4F46E5' },
  poSubtext: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  statusBadgePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  cardDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  detailLabel: { fontSize: 12, color: '#64748B' },
  detailValueBold: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  detailValueMono: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

  // EMPTY STATE
  emptyStateBox: { marginHorizontal: 20, padding: 32, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, alignItems: 'center' },
  emptyStateEmoji: { fontSize: 36, marginBottom: 8 },
  emptyStateTitle: { color: '#0F172A', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  emptyStateDescription: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // MODALS & INPUTS
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6, color: '#475569' },
  innerLabel: { fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4, color: '#64748B' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    color: '#0F172A',
  },

  recipientGridRow: { flexDirection: 'row', gap: 8 },
  recipientChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center' },
  recipientChipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  recipientChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  recipientChipTextActive: { fontWeight: '800', color: '#4F46E5' },

  lineCardBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, backgroundColor: '#F8FAFC', marginBottom: 8 },
  lineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lineTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A' },

  dropdownTriggerBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dropdownTriggerText: { fontSize: 12, color: '#0F172A', flex: 1 },

  outlineAddLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
  },
  outlineAddLineText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },

  documentPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  documentPickerText: { fontSize: 12, fontWeight: '700', color: '#4F46E5', flex: 1 },

  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  pickerOptionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerOptionText: { fontSize: 13, color: '#0F172A' },

  // FOOTER CTA BANNER
  ctaSection: { paddingVertical: 24, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  ctaBanner: { marginHorizontal: 20, backgroundColor: '#4F46E5', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  ctaDecorationCircle: { position: 'absolute', right: -20, bottom: -20, width: 96, height: 96, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 48 },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  ctaDescription: { color: '#E0E7FF', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  ctaButton: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctaButtonText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
});