import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import WebView from 'react-native-webview';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export function YouTubePlayer({ videoId, height = 220 }: YouTubePlayerProps) {
  const [loading, setLoading] = useState(true);

  // Load the full YouTube mobile site to avoid Error 153 (embedding disabled).
  // Then inject CSS/JS to hide all UI — leaving only the video player.
  const youtubeUrl = `https://m.youtube.com/watch?v=${videoId}&autoplay=1`;

  const injectedJS = `
(function hideYouTubeUI() {
  var css = document.createElement('style');
  css.textContent = [
    /* ── Mobile YouTube UI elements to hide ── */
    'ytm-mobile-topbar-renderer',
    '.mobile-topbar-header',
    'ytm-slim-video-header-renderer',
    'ytm-slim-video-information-renderer',
    'ytm-slim-video-action-bar-renderer',
    'ytm-comment-section-renderer',
    'ytm-section-list-renderer',
    'ytm-continuation-item-renderer',
    '.related-chips-bar-renderer',
    'ytm-playlist-panel-renderer',
    'ytm-item-section-renderer',
    'ytm-button-renderer',
    '.slim-video-metadata-section',
    '.slim-video-action-bar',
    '.ytm-watch__meta-collapsed',
    '.ytm-watch__meta-body',
    '#watch-header',
    '#comments-section',
    '#related',
    /* ── Desktop YouTube fallback ── */
    '#masthead-container',
    'ytd-masthead',
    '#below',
    '#info-contents',
    'ytd-video-primary-info-renderer',
    'ytd-video-secondary-info-renderer',
    '#secondary',
    'ytd-comments',
    '#header',
    '.ytp-chrome-top',
    '.ytp-show-cards-title'
  ].join(',') + '{ display:none !important; }';
  document.head.appendChild(css);

  function applyStyles() {
    /* Force body/html to black, no scroll */
    document.documentElement.style.cssText = 'background:#000!important;overflow:hidden!important;';
    document.body.style.cssText = 'background:#000!important;overflow:hidden!important;margin:0!important;padding:0!important;';

    /* Make the video element fill container */
    var video = document.querySelector('video');
    if (video) {
      video.style.cssText = 'width:100%!important;height:100%!important;position:fixed!important;top:0!important;left:0!important;object-fit:contain!important;background:#000!important;z-index:9999!important;';
    }

    /* Hide elements by selector list */
    var hide = [
      'ytm-mobile-topbar-renderer','ytm-slim-video-header-renderer',
      'ytm-slim-video-information-renderer','ytm-slim-video-action-bar-renderer',
      'ytm-comment-section-renderer','ytm-section-list-renderer',
      'ytm-continuation-item-renderer','.slim-video-metadata-section',
      '.slim-video-action-bar','.ytm-watch__meta-collapsed','.ytm-watch__meta-body',
      '#watch-header','#comments-section','ytm-item-section-renderer',
      '#masthead-container','ytd-masthead','#below','#info-contents',
      'ytd-video-primary-info-renderer','ytd-video-secondary-info-renderer',
      '#secondary','ytd-comments','.ytp-chrome-top','.mobile-topbar-header'
    ];
    hide.forEach(function(sel) {
      try {
        document.querySelectorAll(sel).forEach(function(el) {
          el.style.setProperty('display','none','important');
        });
      } catch(e) {}
    });
  }

  applyStyles();
  /* Re-run frequently because YouTube's JS re-renders the DOM */
  [300, 800, 1500, 2500, 4000].forEach(function(t) {
    setTimeout(applyStyles, t);
  });

  /* MutationObserver as ongoing guard */
  try {
    var obs = new MutationObserver(applyStyles);
    obs.observe(document.body || document.documentElement, { childList:true, subtree:true });
  } catch(e) {}
})();
true;
`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ uri: youtubeUrl }}
        style={styles.webView}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={injectedJS}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        originWhitelist={['*', 'https://*.youtube.com', 'https://m.youtube.com']}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        userAgent="Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
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
