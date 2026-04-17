import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Image } from 'expo-image';
import WebView from 'react-native-webview';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export function YouTubePlayer({ videoId, height = 200 }: YouTubePlayerProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  if (!showPlayer) {
    return (
      <Pressable
        style={[styles.container, { height }]}
        onPress={() => setShowPlayer(true)}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <MaterialIcons name="play-arrow" size={48} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>
    );
  }

  // Use a plain WebView iframe embed — no expo-video / SimpleCache involved
  const embedHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
      iframe { width: 100%; height: 100vh; border: none; display: block; }
    </style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen
    ></iframe>
  </body>
</html>
`;

  return (
    <View style={[styles.playerContainer, { height }]}>
      <WebView
        source={{ html: embedHtml }}
        style={styles.player}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  playerContainer: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
});
