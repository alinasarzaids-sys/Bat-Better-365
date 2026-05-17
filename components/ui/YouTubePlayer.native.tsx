import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, Linking, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

const buildHTML = (videoId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    #player { width: 100%; height: 100%; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    var player;
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${videoId}',
        playerVars: {
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          controls: 1,
          fs: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: 'https://youtube.com'
        },
        events: {
          onReady: function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          },
          onError: function(e) {
            // Errors 100/101/150/153 = video unavailable / embedding disabled
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: e.data }));
          },
          onStateChange: function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', state: e.data }));
          }
        }
      });
    }
  </script>
</body>
</html>
`;

export function YouTubePlayer({ videoId, height = 220 }: YouTubePlayerProps) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const webViewRef = useRef<any>(null);

  const openInYouTube = () => {
    const appUrl = `vnd.youtube:${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    Linking.canOpenURL(appUrl)
      .then(supported => Linking.openURL(supported ? appUrl : webUrl))
      .catch(() => Linking.openURL(webUrl));
  };

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setLoading(false);
      } else if (msg.type === 'error') {
        // Embedding blocked codes: 101, 150, 100, 5
        if ([100, 101, 150, 5].includes(msg.code)) {
          setBlocked(true);
          setLoading(false);
        }
      }
    } catch {}
  };

  const handleLoadEnd = () => {
    // Fallback: hide spinner after page loads even if API doesn't fire
    setTimeout(() => setLoading(false), 2000);
  };

  // Embedding blocked — show fallback
  if (blocked) {
    return (
      <Pressable
        style={[styles.blockedContainer, { height }]}
        onPress={openInYouTube}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      >
        <View style={styles.blockedIcon}>
          <MaterialIcons name="play-circle-filled" size={56} color="#FF0000" />
        </View>
        <Text style={styles.blockedTitle}>Video cannot play in-app</Text>
        <Text style={styles.blockedSub}>This video has embedding restrictions.</Text>
        <View style={styles.blockedBtn}>
          <MaterialIcons name="open-in-new" size={16} color="#fff" />
          <Text style={styles.blockedBtnText}>Open in YouTube</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: buildHTML(videoId) }}
        style={styles.webView}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={() => setBlocked(true)}
        onHttpError={() => setBlocked(true)}
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
  blockedContainer: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  blockedIcon: {
    marginBottom: 4,
  },
  blockedTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  blockedSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  blockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF0000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  blockedBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
