import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import WebView from 'react-native-webview';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export function YouTubePlayer({ videoId, height = 220 }: YouTubePlayerProps) {
  const [loading, setLoading] = useState(true);

  // Load the full YouTube website — bypasses ALL embedding restrictions
  // (Error 153/150/101 only affect iframe embeds, not the full site)
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ uri: watchUrl }}
        style={styles.webView}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*', 'https://*.youtube.com', 'https://youtube.com']}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        scrollEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Hide YouTube header/footer UI via CSS injection so only the video is shown
        injectedJavaScript={`
          (function() {
            var style = document.createElement('style');
            style.innerHTML = [
              'ytd-masthead { display: none !important; }',
              '#masthead-container { display: none !important; }',
              'ytd-mini-guide-renderer { display: none !important; }',
              '#guide-button { display: none !important; }',
              'ytd-watch-next-secondary-results-renderer { display: none !important; }',
              '#secondary { display: none !important; }',
              'ytd-comments { display: none !important; }',
            ].join(' ');
            document.head.appendChild(style);
            // Auto-click play if video is paused
            setTimeout(function() {
              var playBtn = document.querySelector('.ytp-play-button');
              if (playBtn) playBtn.click();
            }, 1500);
          })();
          true;
        `}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#FF0000" size="large" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
});
