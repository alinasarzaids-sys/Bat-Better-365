import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Text } from 'react-native';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import YoutubePlayer from 'react-native-youtube-iframe';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export function YouTubePlayer({ videoId, height = 200 }: YouTubePlayerProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  if (!showPlayer) {
    // Show thumbnail until user clicks to play
    return (
      <Pressable 
        style={[styles.container, { height }]}
        onPress={() => setShowPlayer(true)}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <MaterialIcons name="play-arrow" size={48} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.playerContainer, { height }]}>
      <YoutubePlayer
        height={height}
        videoId={videoId}
        play={true}
        webViewStyle={styles.player}
        initialPlayerParams={{
          controls: true,
          modestbranding: true,
          preventFullScreen: false,
          rel: false,
        }}
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
    backgroundColor: 'transparent',
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
    opacity: 0.99,
  },
});
