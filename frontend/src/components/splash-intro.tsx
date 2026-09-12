import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/src/theme";

const SPLASH_VIDEO = require("../../assets/videos/splash.mp4");

/** Shown once per cold start, then hands off to auth / home. */
export function SplashIntro({ onDone }: { onDone: () => void }) {
  const finished = useRef(false);
  const [ready, setReady] = useState(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEventListener(player, "playToEnd", () => {
    finish();
  });

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "readyToPlay") {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
    if (status === "error") {
      console.warn("Splash video error", error);
      finish();
    }
  });

  useEffect(() => {
    // Safety net if the video never fires playToEnd
    const t = setTimeout(finish, 12000);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <View style={styles.root} testID="splash-intro">
      <StatusBar style="light" />
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {!ready && <View style={[StyleSheet.absoluteFill, styles.fallback]} />}
      <Pressable
        testID="splash-skip"
        style={styles.skip}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Passer l'intro"
      >
        <Text style={styles.skipText}>Passer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  fallback: {
    backgroundColor: "#000",
  },
  skip: {
    position: "absolute",
    right: 20,
    bottom: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  skipText: {
    color: colors.onSurfaceInverse,
    fontSize: 14,
    fontWeight: "500",
  },
});
