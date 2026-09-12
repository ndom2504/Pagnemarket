import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { HERO_CATEGORY_IMAGES } from "@/src/category-images";

const FADE_MS = 900;
const HOLD_MS = 4200;

function nextIndex(current: number, length: number) {
  if (length <= 1) return 0;
  let n = current;
  while (n === current) n = Math.floor(Math.random() * length);
  return n;
}

/** Full-bleed random crossfade of category cards behind the home hero. */
export function HeroCategoryBackdrop() {
  const images = HERO_CATEGORY_IMAGES;
  const [aIndex, setAIndex] = useState(() => Math.floor(Math.random() * images.length));
  const [bIndex, setBIndex] = useState(() => nextIndex(aIndex, images.length));
  const opacityA = useRef(new Animated.Value(1)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const active = useRef<"a" | "b">("a");
  const aRef = useRef(aIndex);
  const bRef = useRef(bIndex);
  aRef.current = aIndex;
  bRef.current = bIndex;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        const fromA = active.current === "a";
        const next = nextIndex(fromA ? aRef.current : bRef.current, images.length);
        if (fromA) {
          setBIndex(next);
          Animated.parallel([
            Animated.timing(opacityA, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
            Animated.timing(opacityB, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
          ]).start(({ finished }) => {
            if (!finished || cancelled) return;
            active.current = "b";
            schedule();
          });
        } else {
          setAIndex(next);
          Animated.parallel([
            Animated.timing(opacityB, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
            Animated.timing(opacityA, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
          ]).start(({ finished }) => {
            if (!finished || cancelled) return;
            active.current = "a";
            schedule();
          });
        }
      }, HOLD_MS);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      opacityA.stopAnimation();
      opacityB.stopAnimation();
    };
  }, [images.length, opacityA, opacityB]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]}>
        <Image source={images[aIndex]} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityB }]}>
        <Image source={images[bIndex]} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
    </View>
  );
}
