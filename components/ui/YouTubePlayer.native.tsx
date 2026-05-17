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
          (function injectStyles() {
            var style = document.createElement('style');
            style.innerHTML = [
              /* Hide all YouTube chrome except the video player */
              '#masthead-container, ytd-masthead, #header, #guide-button { display: none !important; }',
              'ytd-mini-guide-renderer, tp-yt-app-drawer { display: none !important; }',
              '#secondary, ytd-watch-next-secondary-results-renderer { display: none !important; }',
              'ytd-comments, #comments { display: none !important; }',
              '#below, ytd-item-section-renderer { display: none !important; }',
              '#info-contents, #info, ytd-video-primary-info-renderer { display: none !important; }',
              'ytd-video-secondary-info-renderer { display: none !important; }',
              '#description, ytd-expander { display: none !important; }',
              /* Remove all padding/margin around the player */
              'html, body { margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }',
              '#page-manager, ytd-watch-flexy { background: #000 !important; }',
              '#player-container, #player, #ytd-player, ytd-player { width: 100vw !important; }',
              /* Make the video element fill the full screen */
              '.html5-video-player, .html5-main-video { width: 100vw !important; height: 100vh !important; position: fixed !important; top: 0 !important; left: 0 !important; z-index: 9999 !important; }',
              'video { width: 100vw !important; height: 100vh !important; object-fit: contain !important; position: fixed !important; top: 0 !important; left: 0 !important; z-index: 9999 !important; background: #000 !important; }',
              /* Hide player top chrome (title bar overlay) */
              '.ytp-chrome-top, .ytp-title { display: none !important; }',
            ].join(' ');
            document.head.appendChild(style);

            // Re-apply after dynamic content loads
            var observer = new MutationObserver(function() {
              document.head.appendChild(style.cloneNode(true));
            });
            observer.observe(document.body || document.documentElement, { childList: true, subtree: false });

            // Auto-play
            setTimeout(function() {
              var v = document.querySelector('video');
              if (v && v.paused) { v.play().catch(function(){}); }
            }, 2000);
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
