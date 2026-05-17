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
        // Inject CSS + JS to make video fill the full player container
        injectedJavaScript={`
          (function setup() {
            function applyStyles() {
              var existing = document.getElementById('__bb365_style');
              if (!existing) {
                var style = document.createElement('style');
                style.id = '__bb365_style';
                style.innerHTML = [
                  'html, body { margin:0!important; padding:0!important; background:#000!important; overflow:hidden!important; width:100vw!important; height:100vh!important; }',
                  /* Hide every YouTube UI element except the video */
                  '#masthead-container, ytd-masthead, #header, tp-yt-app-header, #guide-button { display:none!important; height:0!important; }',
                  'ytd-mini-guide-renderer, tp-yt-app-drawer, #nav-drawer { display:none!important; }',
                  '#secondary, ytd-watch-next-secondary-results-renderer { display:none!important; }',
                  'ytd-comments, #comments, #below, #info-contents, #info { display:none!important; }',
                  'ytd-video-primary-info-renderer, ytd-video-secondary-info-renderer { display:none!important; }',
                  '#description, ytd-expander, ytd-item-section-renderer { display:none!important; }',
                  '.ytp-chrome-top, .ytp-title, .ytp-share-button { display:none!important; }',
                  /* Force the player container to fill the viewport */
                  '#page-manager, ytd-app, ytd-watch-flexy, #player-theater-container, ytd-watch-flexy[theater] { margin:0!important; padding:0!important; background:#000!important; }',
                  '#player-container-id, #player-container, #ytd-player, ytd-player { position:fixed!important; top:0!important; left:0!important; width:100vw!important; height:100vh!important; z-index:9999!important; background:#000!important; }',
                  '.html5-video-player { position:fixed!important; top:0!important; left:0!important; width:100vw!important; height:100vh!important; z-index:9999!important; background:#000!important; }',
                  'video { position:fixed!important; top:0!important; left:0!important; width:100vw!important; height:100vh!important; object-fit:contain!important; z-index:9999!important; background:#000!important; }',
                ].join(' ');
                (document.head || document.documentElement).appendChild(style);
              }

              /* Scroll to top so video is in view */
              window.scrollTo(0, 0);

              /* Force-click the video to unmute/play if muted */
              var v = document.querySelector('video');
              if (v) {
                v.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;object-fit:contain!important;z-index:9999!important;background:#000!important;';
                if (v.paused) { v.play().catch(function(){}); }
              }
            }

            /* Run immediately */
            applyStyles();

            /* Re-run after page settles (YouTube loads content dynamically) */
            setTimeout(applyStyles, 500);
            setTimeout(applyStyles, 1500);
            setTimeout(applyStyles, 3000);

            /* Watch for DOM mutations and re-apply */
            var observer = new MutationObserver(function() { applyStyles(); });
            var target = document.body || document.documentElement;
            if (target) { observer.observe(target, { childList: true, subtree: true }); }
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
