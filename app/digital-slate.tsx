import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProjects } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import PermissionGate from '@/contexts/PermissionGate';

export default function DigitalSlateScreen() {
  const { activeProject } = useProjects();
  const [scene, setScene] = useState('1');
  const [shot, setShot] = useState('1A');
  const [take, setTake] = useState('1');
  const [isClapped, setIsClapped] = useState(false);
  const [timestamp, setTimestamp] = useState('');

  const slapAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimestamp(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClap = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsClapped(true);
    Animated.sequence([
      Animated.timing(slapAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(slapAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setIsClapped(false), 1500);
  }, []);

  const incrementTake = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTake(prev => String(parseInt(prev, 10) + 1 || 1));
  }, []);

  const slapRotate = slapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-15deg'],
  });

  return (
    <PermissionGate resource="digital_slate">
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Digital Slate', headerStyle: { backgroundColor: '#000' } }} />

      <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none" />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.slateBody}>
          <Animated.View style={[styles.slapStick, { transform: [{ rotate: slapRotate }] }]}>
            <View style={styles.slapStickInner}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <View key={i} style={[styles.slapStripe, i % 2 === 0 ? styles.stripeBlack : styles.stripeWhite]} />
              ))}
            </View>
          </Animated.View>

          <View style={styles.slateContent}>
            <Text style={styles.prodTitle}>{activeProject?.title ?? 'PRODUCTION'}</Text>
            <Text style={styles.directorText}>Dir: {activeProject?.director ?? 'Director'}</Text>

            <View style={styles.slateGrid}>
              <View style={styles.slateCell}>
                <Text style={styles.slateCellLabel}>SCENE</Text>
                <TextInput style={styles.slateCellValue} value={scene} onChangeText={setScene}
                  keyboardType="default" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
              </View>
              <View style={styles.slateDivider} />
              <View style={styles.slateCell}>
                <Text style={styles.slateCellLabel}>SHOT</Text>
                <TextInput style={styles.slateCellValue} value={shot} onChangeText={setShot}
                  keyboardType="default" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
              </View>
              <View style={styles.slateDivider} />
              <View style={styles.slateCell}>
                <Text style={styles.slateCellLabel}>TAKE</Text>
                <TextInput style={styles.slateCellValue} value={take} onChangeText={setTake}
                  keyboardType="number-pad" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
              </View>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{timestamp}</Text>
              <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </View>

            {isClapped && (
              <View style={styles.clappedBadge}>
                <Text style={styles.clappedText}>MARK!</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.nextTakeBtn} onPress={incrementTake} activeOpacity={0.7}>
          <Text style={styles.nextTakeText}>Next Take</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clapBtn} onPress={handleClap} activeOpacity={0.8}>
          <Text style={styles.clapBtnText}>CLAP</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 10 },
  slateBody: { flex: 1, margin: 16, borderRadius: 16, backgroundColor: '#1a1a1a', overflow: 'hidden', borderWidth: 2, borderColor: '#333' },
  slapStick: { height: 48, backgroundColor: '#111', borderBottomWidth: 2, borderBottomColor: '#333', transformOrigin: 'left center' },
  slapStickInner: { flex: 1, flexDirection: 'row' },
  slapStripe: { flex: 1, height: '100%' },
  stripeBlack: { backgroundColor: '#111' },
  stripeWhite: { backgroundColor: '#e8e8e8' },
  slateContent: { flex: 1, padding: 20, justifyContent: 'center' },
  prodTitle: { fontSize: 24, fontWeight: '900' as const, color: '#fff', textAlign: 'center', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 4 },
  directorText: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 },
  slateGrid: { flexDirection: 'row', backgroundColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  slateCell: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  slateDivider: { width: 1, backgroundColor: '#333' },
  slateCellLabel: { fontSize: 10, fontWeight: '700' as const, color: '#666', letterSpacing: 1.5, marginBottom: 6 },
  slateCellValue: { fontSize: 32, fontWeight: '900' as const, color: '#fff', fontVariant: ['tabular-nums'], minWidth: 60, padding: 0 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 8 },
  timeText: { fontSize: 20, fontWeight: '700' as const, color: Colors.status.error, fontVariant: ['tabular-nums'] },
  dateText: { fontSize: 14, color: '#666', alignSelf: 'flex-end' },
  clappedBadge: { position: 'absolute', top: 20, right: 20, backgroundColor: Colors.status.error, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  clappedText: { fontSize: 12, fontWeight: '800' as const, color: '#fff', letterSpacing: 1 },
  controls: { flexDirection: 'row', padding: 16, gap: 12 },
  nextTakeBtn: { flex: 1, backgroundColor: '#222', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  nextTakeText: { fontSize: 15, fontWeight: '600' as const, color: '#fff' },
  clapBtn: { flex: 2, backgroundColor: Colors.status.error, borderRadius: 12, padding: 16, alignItems: 'center' },
  clapBtnText: { fontSize: 18, fontWeight: '900' as const, color: '#fff', letterSpacing: 2 },
});
