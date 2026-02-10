import React, {useEffect, useRef} from 'react';
import {Animated, View, StyleSheet, Easing} from 'react-native';

interface VibeSpinnerProps {
  size?: number;
}

/**
 * Animated color-shifting sphere spinner.
 * Rotates continuously while cycling through Solana-themed gradient colors.
 *
 * IMPORTANT: Native-driven animations (transform) and JS-driven animations
 * (backgroundColor) must live on SEPARATE Animated.View nodes. Mixing them
 * on the same node crashes Android with:
 *   "Attempting to run JS driven animation on animated node that has been
 *    moved to native earlier by starting an animation with useNativeDriver: true"
 */
export function VibeSpinner({size = 48}: VibeSpinnerProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const colorPhase = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Continuous rotation — native driver for smooth 60fps transforms
    const rotateAnim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    // Color cycling (0 → 1 → 0) — JS driver (backgroundColor can't use native)
    const colorAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(colorPhase, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(colorPhase, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    // Pulse scale — native driver for smooth transforms
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    rotateAnim.start();
    colorAnim.start();
    pulseAnim.start();

    return () => {
      rotateAnim.stop();
      colorAnim.stop();
      pulseAnim.stop();
    };
  }, [rotation, colorPhase, pulse]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Cycle through Solana colors: green → purple → cyan → green
  const bgColor = colorPhase.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: ['#14F195', '#9F6AFF', '#00D4FF', '#14F195'],
  });

  const glowColor = colorPhase.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      'rgba(20,241,149,0.3)',
      'rgba(159,106,255,0.3)',
      'rgba(0,212,255,0.3)',
      'rgba(20,241,149,0.3)',
    ],
  });

  return (
    <View style={[styles.wrapper, {width: size * 1.5, height: size * 1.5}]}>
      {/* Glow ring: outer = native transform (scale), inner = JS color */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size * 0.7,
            transform: [{scale: pulse}],
          },
        ]}>
        <Animated.View
          style={{
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size * 0.7,
            backgroundColor: glowColor,
          }}
        />
      </Animated.View>
      {/* Main sphere: outer = native transforms (rotate + scale), inner = JS color */}
      <Animated.View
        style={[
          styles.sphereTransform,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{rotate: spin}, {scale: pulse}],
          },
        ]}>
        <Animated.View
          style={[
            styles.sphere,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bgColor,
            },
          ]}
        />
      </Animated.View>
      {/* Highlight */}
      <View
        style={[
          styles.highlight,
          {
            width: size * 0.35,
            height: size * 0.2,
            borderRadius: size * 0.15,
            top: size * 0.55,
            left: size * 0.65,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sphereTransform: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sphere: {
    shadowColor: '#14F195',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
