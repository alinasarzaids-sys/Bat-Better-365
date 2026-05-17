import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export function YouTubePlayer({ videoId, height = 220 }: YouTubePlayerProps) {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  const openInYouTube = () => {
    const appUrl = `vnd.youtube:${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    Linking.canOpenURL(appUrl)
      .then(supported => Linking.openURL(supported ? appUrl : webUrl))
      .catch(() => Linking.openURL(webUrl));
  };

  return (
    <Pressable
      style={[styles.container, { height }]}
      onPress={openInYouTube}
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
    >
      {/* Thumbnail */}
      <Image
        source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={300}
        onLoad={() => setThumbnailLoaded(true)}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Loading spinner while thumbnail loads */}
      {!thumbnailLoaded && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Play button */}
      <View style={styles.playButtonWrapper}>
        <View style={styles.playButton}>
          <MaterialIcons name="play-arrow" size={52} color="#FFFFFF" />
        </View>
        <Text style={styles.watchLabel}>Tap to Watch</Text>
      </View>

      {/* YouTube badge bottom-right */}
      <View style={styles.ytBadge}>
        <MaterialIcons name="smart-display" size={16} color="#FF0000" />
        <Text style={styles.ytBadgeText}>YouTube</Text>
        <MaterialIcons name="open-in-new" size={13} color="rgba(255,255,255,0.85)" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  watchLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ytBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ytBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
