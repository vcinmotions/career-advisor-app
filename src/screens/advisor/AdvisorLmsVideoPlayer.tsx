import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { mobileApiClient } from '../../api/mobileClient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  title: string;
  url: string;
  videoId: string;
  kind: 'orientation' | 'training';
  moduleId?: string;
  onClose: () => void;
  onUpdated: () => void;
};

export default function AdvisorLmsVideoPlayer({
  visible,
  title,
  url,
  videoId,
  kind,
  moduleId,
  onClose,
  onUpdated,
}: Props) {
  const player = useVideoPlayer(url, (instance) => {
    instance.timeUpdateEventInterval = 5;
  });

  const timeUpdateEvent = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdateEvent?.currentTime ?? 0;
  const duration = player.duration || 0;

  const [saving, setSaving] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  const watchTime = useRef(0);
  const requestBusy = useRef(false);

  useEffect(() => {
    if (!visible) {
      player.pause();
      return;
    }

    const timer = setInterval(() => {
      if (!player.playing || requestBusy.current) return;
      watchTime.current += 5;

      const position = Math.max(0, Math.floor(player.currentTime));
      const dur = Math.max(0, player.duration || 0);
      if (!position || !dur) return;

      const percentageWatched = Math.min(100, Math.round((position / dur) * 100));

      requestBusy.current = true;
      setSaving(true);

      mobileApiClient
        .patch(
          kind === 'orientation'
            ? `/lms/me/orientation/videos/${videoId}/progress`
            : `/lms/me/training/videos/${videoId}/progress`,
          {
            watchTimeSec: watchTime.current,
            lastPositionSec: position,
            percentageWatched,
          }
        )
        .then((response) => {
          if (response.data?.data?.isCompleted) setVideoCompleted(true);
          onUpdated();
        })
        .catch((error) => {
          Alert.alert(
            'Progress Sync Notice',
            error?.response?.data?.message || 'Progress update deferred to next playback interval.'
          );
        })
        .finally(() => {
          requestBusy.current = false;
          setSaving(false);
        });
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
      Alert.alert('Module Complete 🎉', 'Smart Skills recorded your completion.');
      onClose();
    } catch (error: any) {
      Alert.alert(
        'Requirement Pending',
        error?.response?.data?.message || 'Watch required video to at least 90% and try again.'
      );
    } finally {
      setCompleting(false);
    }
  };

  const formattedCurrentTime = Math.floor(currentTime || 0);
  const formattedDuration = Math.floor(duration || 0);
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screenContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

        {/* ─── HEADER BAR ─── */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.badgePill}>
              <View style={styles.livePulseDot} />
              <Text style={styles.badgePillText}>
                {kind === 'orientation' ? 'LIVE ORIENTATION STREAM' : 'TRAINING MODULE STREAM'}
              </Text>
            </View>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <TouchableOpacity style={styles.closeIconButton} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ─── VIDEO VIEWPORT ─── */}
        <View style={styles.videoViewportCard}>
          <VideoView player={player} style={styles.videoPlayer} nativeControls contentFit="contain" />
        </View>

        {/* ─── CONTROLS & FOOTER ─── */}
        <View style={styles.controlsFooter}>
          {/* Progress Bar Ribbon */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.statusInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={videoCompleted ? 'checkmark-circle' : 'time-outline'}
                size={16}
                color={videoCompleted ? '#10B981' : '#818CF8'}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.timeInfoText}>
                {formattedCurrentTime}s / {formattedDuration > 0 ? `${formattedDuration}s` : '—'}
                {videoCompleted ? ' (Watched ✓)' : ''}
              </Text>
            </View>

            {saving && (
              <View style={styles.savingTag}>
                <ActivityIndicator size="small" color="#818CF8" style={{ marginRight: 4 }} />
                <Text style={styles.savingTagText}>Syncing progress…</Text>
              </View>
            )}
          </View>

          {/* Module Complete Trigger for Training Videos */}
          {kind === 'training' && (
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                style={[
                  styles.solidPrimaryButton,
                  (!videoCompleted || completing) && styles.buttonDisabled,
                ]}
                disabled={!videoCompleted || completing}
                activeOpacity={0.8}
                onPress={completeModule}
              >
                {completing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name="checkmark-done-circle-outline"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.solidPrimaryButtonText}>Mark Module Complete ✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              {!videoCompleted && (
                <Text style={styles.helperNoticeText}>
                  Watch at least 90% of the video stream to unlock module completion.
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#0B0F19', justifyContent: 'space-between' },

  // HEADER BAR
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  badgePillText: { fontSize: 9, fontWeight: '800', color: '#A5B4FC', letterSpacing: 0.5 },
  headerTitleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // VIDEO VIEWPORT
  videoViewportCard: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  videoPlayer: { width: '100%', height: '100%' },

  // CONTROLS & FOOTER
  controlsFooter: { padding: 20, backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: '#1E293B' },
  progressBarTrack: { height: 4, backgroundColor: '#1E293B', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', backgroundColor: '#4F46E5' },

  statusInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeInfoText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  savingTag: { flexDirection: 'row', alignItems: 'center' },
  savingTagText: { color: '#818CF8', fontSize: 11, fontWeight: '600' },

  // BUTTONS
  solidPrimaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidPrimaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  buttonDisabled: { opacity: 0.4 },
  helperNoticeText: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 8 },
});