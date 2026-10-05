import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { mobileApiClient } from '../../api/mobileClient';

type Props = { visible: boolean; title: string; url: string; videoId: string; kind: 'orientation' | 'training'; moduleId?: string; onClose: () => void; onUpdated: () => void };

export default function AdvisorLmsVideoPlayer({ visible, title, url, videoId, kind, moduleId, onClose, onUpdated }: Props) {
  const player = useVideoPlayer(url, (instance) => { instance.timeUpdateEventInterval = 5; });
  const timeUpdateEvent = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdateEvent?.currentTime ?? 0;
  const [saving, setSaving] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const watchTime = useRef(0);
  const requestBusy = useRef(false);

  useEffect(() => {
    if (!visible) { player.pause(); return; }
    const timer = setInterval(() => {
      if (!player.playing || requestBusy.current) return;
      watchTime.current += 5;
      const position = Math.max(0, Math.floor(player.currentTime));
      const duration = Math.max(0, player.duration || 0);
      if (!position || !duration) return;
      const percentageWatched = Math.min(100, Math.round((position / duration) * 100));
      requestBusy.current = true;
      setSaving(true);
      mobileApiClient.patch(kind === 'orientation'
        ? `/lms/me/orientation/videos/${videoId}/progress`
        : `/lms/me/training/videos/${videoId}/progress`, {
        watchTimeSec: watchTime.current,
        lastPositionSec: position,
        percentageWatched,
      }).then((response) => {
        if (response.data?.data?.isCompleted) setVideoCompleted(true);
        onUpdated();
      }).catch((error) => {
        Alert.alert('Progress not saved', error?.response?.data?.message || 'Your progress will be retried the next time you play this video.');
      }).finally(() => { requestBusy.current = false; setSaving(false); });
    }, 5000);
    return () => {
      clearInterval(timer);
      player.pause();
    };
  }, [visible, player, videoId, kind, onUpdated]);

  const completeModule = async () => {
    if (!moduleId) return;
    setCompleting(true);
    try {
      await mobileApiClient.post(`/lms/me/training/modules/${moduleId}/complete`, {});
      onUpdated();
      Alert.alert('Training module complete', 'Smart Skills recorded your completion.');
      onClose();
    } catch (error: any) {
      Alert.alert('Could not complete module', error?.response?.data?.message || 'Finish the required video and try again.');
    } finally { setCompleting(false); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.screen}>
      <View style={styles.header}><Text style={styles.title}>{title}</Text><TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity></View>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
      <View style={styles.footer}>
        <Text style={styles.info}>{videoCompleted ? 'Video completed' : `Position ${Math.floor(currentTime || 0)} seconds`}{saving ? ' · Saving progress…' : ''}</Text>
        {kind === 'training' && <TouchableOpacity style={[styles.button, (!videoCompleted || completing) && styles.disabled]} disabled={!videoCompleted || completing} onPress={completeModule}>{completing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mark module complete</Text>}</TouchableOpacity>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center' }, header: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, paddingRight: 12 }, close: { color: '#C7D2FE', fontWeight: '700' }, video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }, footer: { padding: 18 }, info: { color: '#CBD5E1', marginBottom: 14 }, button: { backgroundColor: '#4F46E5', padding: 14, alignItems: 'center', borderRadius: 8 }, buttonText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.45 } });
