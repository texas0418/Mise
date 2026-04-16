import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, TextInput, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, CircleDot, CircleCheck, CircleX, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectTakes } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { Take } from '@/types';

// ─── Compact Slate ───────────────────────────────────────────────
function CompactSlate({ 
  scene, shot, take, onSceneChange, onShotChange, onTakeChange, 
  onClap, onNextTake, projectTitle, director, timestamp, isClapped 
}: {
  scene: string; shot: string; take: string;
  onSceneChange: (v: string) => void; onShotChange: (v: string) => void; onTakeChange: (v: string) => void;
  onClap: () => void; onNextTake: () => void;
  projectTitle: string; director: string; timestamp: string; isClapped: boolean;
}) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const slapAnim = useRef(new Animated.Value(0)).current;

  const handleClap = useCallback(() => {
    Keyboard.dismiss();
    onClap();
    // Slap animation
    Animated.sequence([
      Animated.timing(slapAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(slapAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    // Flash
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [onClap]);

  const slapRotate = slapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-12deg'],
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.slateContainer}>
        <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none" />
        
        {/* Clapper stripes */}
        <Animated.View style={[styles.slapStick, { transform: [{ rotate: slapRotate }] }]}>
          <View style={styles.slapStickInner}>
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <View key={i} style={[styles.slapStripe, i % 2 === 0 ? styles.stripeBlack : styles.stripeWhite]} />
            ))}
          </View>
        </Animated.View>

        {/* Slate body */}
        <View style={styles.slateBody}>
          <View style={styles.slateTitleRow}>
            <View>
              <Text style={styles.prodTitle}>{projectTitle}</Text>
              <Text style={styles.directorText}>Dir: {director}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Text style={styles.timeText}>{timestamp}</Text>
              <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
          </View>

          {/* Scene / Shot / Take fields */}
          <View style={styles.slateGrid}>
            <View style={styles.slateCell}>
              <Text style={styles.slateCellLabel}>SCENE</Text>
              <TextInput style={styles.slateCellValue} value={scene} onChangeText={onSceneChange}
                keyboardType="default" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            </View>
            <View style={styles.slateDivider} />
            <View style={styles.slateCell}>
              <Text style={styles.slateCellLabel}>SHOT</Text>
              <TextInput style={styles.slateCellValue} value={shot} onChangeText={onShotChange}
                keyboardType="default" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            </View>
            <View style={styles.slateDivider} />
            <View style={styles.slateCell}>
              <Text style={styles.slateCellLabel}>TAKE</Text>
              <TextInput style={styles.slateCellValue} value={take} onChangeText={onTakeChange}
                keyboardType="number-pad" textAlign="center" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            </View>
          </View>

          {/* Controls */}
          <View style={styles.slateControls}>
            <TouchableOpacity style={styles.nextTakeBtn} onPress={onNextTake} activeOpacity={0.7}>
              <Text style={styles.nextTakeText}>Next Take</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clapBtn} onPress={handleClap} activeOpacity={0.8}>
              <Text style={styles.clapBtnText}>{isClapped ? 'MARK!' : 'CLAP'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Take Card ───────────────────────────────────────────────────
function TakeCard({ take, onToggleCircle }: { take: Take; onToggleCircle: (take: Take) => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleCircle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggleCircle(take);
  }, [take, onToggleCircle]);

  const time = new Date(take.timestamp);
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <View style={[
        styles.takeCard,
        take.isCircled && styles.takeCardCircled,
        take.isNG && styles.takeCardNG,
      ]}>
        <TouchableOpacity style={styles.circleBtn} onPress={handleCircle} activeOpacity={0.7}>
          {take.isCircled ? (
            <CircleCheck color={Colors.status.active} size={26} />
          ) : take.isNG ? (
            <CircleX color={Colors.status.error} size={26} />
          ) : (
            <CircleDot color={Colors.text.tertiary} size={26} />
          )}
        </TouchableOpacity>
        <View style={styles.takeInfo}>
          <View style={styles.takeHeader}>
            <Text style={styles.takeLabel}>Sc.{take.sceneNumber} / {take.shotNumber}</Text>
            <View style={styles.takeBadge}>
              <Text style={styles.takeBadgeText}>T{take.takeNumber}</Text>
            </View>
          </View>
          {take.notes ? (
            <Text style={styles.takeNotes} numberOfLines={2}>{take.notes}</Text>
          ) : null}
        </View>
        <Text style={styles.takeTime}>{timeStr}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────
export default function OnSetScreen() {
  const { activeProject, activeProjectId, updateTake } = useProjects();
  const takes = useProjectTakes(activeProjectId);
  const router = useRouter();

  // Slate state
  const [scene, setScene] = useState('1');
  const [shot, setShot] = useState('1A');
  const [take, setTake] = useState('1');
  const [isClapped, setIsClapped] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [slateCollapsed, setSlateCollapsed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimestamp(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsClapped(true);
    setTimeout(() => setIsClapped(false), 1500);
  }, []);

  const incrementTake = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTake(prev => String((parseInt(prev, 10) || 0) + 1));
  }, []);

  const sortedTakes = useMemo(() => {
    return [...takes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [takes]);

  const stats = useMemo(() => ({
    total: takes.length,
    circled: takes.filter(t => t.isCircled).length,
    ng: takes.filter(t => t.isNG).length,
  }), [takes]);

  const handleToggleCircle = useCallback((t: Take) => {
    updateTake({ ...t, isCircled: !t.isCircled });
  }, [updateTake]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Text style={styles.emptySubtitle}>Select a project from the Projects tab</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.headerTitle}>Digital Slate</Text>
        </View>
        <Text style={styles.headerProject}>{activeProject.title}</Text>
      </View>

      {/* Collapse toggle */}
      <TouchableOpacity 
        style={styles.collapseToggle} 
        onPress={() => setSlateCollapsed(!slateCollapsed)} 
        activeOpacity={0.7}
      >
        <Text style={styles.collapseText}>
          {slateCollapsed ? 'Show Slate' : 'Hide Slate'}
        </Text>
        {slateCollapsed ? (
          <ChevronDown color={Colors.text.tertiary} size={16} />
        ) : (
          <ChevronUp color={Colors.text.tertiary} size={16} />
        )}
      </TouchableOpacity>

      {/* Slate */}
      {!slateCollapsed && (
        <CompactSlate
          scene={scene} shot={shot} take={take}
          onSceneChange={setScene} onShotChange={setShot} onTakeChange={setTake}
          onClap={handleClap} onNextTake={incrementTake}
          projectTitle={activeProject.title} director={activeProject.director || 'Director'}
          timestamp={timestamp} isClapped={isClapped}
        />
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Takes</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxHighlight]}>
          <Text style={[styles.statValue, { color: Colors.status.active }]}>{stats.circled}</Text>
          <Text style={styles.statLabel}>Circled</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: Colors.status.error }]}>{stats.ng}</Text>
          <Text style={styles.statLabel}>NG</Text>
        </View>
      </View>

      {/* Take log */}
      <FlatList
        data={sortedTakes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TakeCard take={item} onToggleCircle={handleToggleCircle} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <CircleDot color={Colors.text.tertiary} size={40} />
            <Text style={styles.emptyTitle}>No takes logged</Text>
            <Text style={styles.emptySubtitle}>Log takes to track your shoot progress</Text>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/log-take' as never)} 
        activeOpacity={0.8}
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.status.error },
  headerTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.primary },
  headerProject: { fontSize: 12, color: Colors.accent.gold, fontWeight: '600' as const },

  // Collapse toggle
  collapseToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  collapseText: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '600' as const },

  // Slate
  slateContainer: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 14, backgroundColor: '#111', overflow: 'hidden', borderWidth: 1.5, borderColor: '#333' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 10, borderRadius: 14 },
  slapStick: { height: 32, backgroundColor: '#111', borderBottomWidth: 1.5, borderBottomColor: '#333', transformOrigin: 'left center' },
  slapStickInner: { flex: 1, flexDirection: 'row' },
  slapStripe: { flex: 1, height: '100%' },
  stripeBlack: { backgroundColor: '#111' },
  stripeWhite: { backgroundColor: '#e8e8e8' },
  slateBody: { padding: 14 },
  slateTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  prodTitle: { fontSize: 16, fontWeight: '900' as const, color: '#fff', textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  directorText: { fontSize: 11, color: '#666', marginTop: 2 },
  timeBlock: { alignItems: 'flex-end' },
  timeText: { fontSize: 16, fontWeight: '700' as const, color: Colors.status.error, fontVariant: ['tabular-nums'] },
  dateText: { fontSize: 10, color: '#555', marginTop: 1 },

  // Slate grid
  slateGrid: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  slateCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  slateDivider: { width: 1, backgroundColor: '#2a2a2a' },
  slateCellLabel: { fontSize: 9, fontWeight: '700' as const, color: '#555', letterSpacing: 1.5, marginBottom: 4 },
  slateCellValue: { fontSize: 26, fontWeight: '900' as const, color: '#fff', fontVariant: ['tabular-nums'], minWidth: 50, padding: 0 },

  // Slate controls
  slateControls: { flexDirection: 'row', marginTop: 12, gap: 10 },
  nextTakeBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  nextTakeText: { fontSize: 13, fontWeight: '600' as const, color: '#fff' },
  clapBtn: { flex: 2, backgroundColor: Colors.status.error, borderRadius: 10, padding: 12, alignItems: 'center' },
  clapBtnText: { fontSize: 15, fontWeight: '900' as const, color: '#fff', letterSpacing: 2 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  statBox: { flex: 1, backgroundColor: Colors.bg.card, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  statBoxHighlight: { borderColor: Colors.status.active + '33', backgroundColor: Colors.status.active + '08' },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 9, color: Colors.text.tertiary, marginTop: 2, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  // Take list
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  takeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 0.5, borderColor: Colors.border.subtle },
  takeCardCircled: { borderColor: Colors.status.active + '44', backgroundColor: Colors.status.active + '08' },
  takeCardNG: { borderColor: Colors.status.error + '33', backgroundColor: Colors.status.error + '06' },
  circleBtn: { marginRight: 10, padding: 2 },
  takeInfo: { flex: 1 },
  takeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  takeLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary, fontVariant: ['tabular-nums'] },
  takeBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  takeBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Colors.accent.gold },
  takeNotes: { fontSize: 11, color: Colors.text.secondary, marginTop: 3, lineHeight: 16 },
  takeTime: { fontSize: 10, color: Colors.text.tertiary, fontVariant: ['tabular-nums'], marginLeft: 8 },

  // Empty states
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
