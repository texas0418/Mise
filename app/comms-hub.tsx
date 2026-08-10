import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share, Linking } from 'react-native';
import { Plus, Send, Clock, AlertTriangle, MessageCircle, Trash2, Share2, ChevronDown, ChevronUp, Megaphone } from 'lucide-react-native';
import { useProjects, useProjectMessages, useProjectCrew } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { DirectorMessage, MessageCategory, MessagePriority } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';
import { useGuardedRouter } from '@/utils/useGuardedRouter';
import * as SMS from 'expo-sms';
import * as MailComposer from 'expo-mail-composer';
import {
  resolveAudience, composeBody, describeAudience, phoneNumbers, emailAddresses,
  mailtoUrl, type Contactable,
} from '@/utils/messageDelivery';

const CATEGORY_CONFIG: Record<MessageCategory, { label: string; color: string; icon: string }> = {
  'moving-on': { label: 'Moving On', color: '#34D399', icon: '→' },
  'pickup': { label: 'Pickup', color: '#F59E0B', icon: '↻' },
  'schedule-change': { label: 'Schedule', color: '#60A5FA', icon: '◷' },
  'safety': { label: 'Safety', color: '#EF4444', icon: '⚠' },
  'creative': { label: 'Creative', color: '#A78BFA', icon: '✦' },
  'general': { label: 'General', color: '#9CA3AF', icon: '●' },
};

const PRIORITY_CONFIG: Record<MessagePriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: Colors.text.tertiary },
  urgent: { label: 'URGENT', color: '#EF4444' },
  fyi: { label: 'FYI', color: '#60A5FA' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MessageCard({ msg, onDelete, onShare, onSendText, onSendEmail }: {
  msg: DirectorMessage;
  onDelete: () => void;
  onShare: () => void;
  onSendText: () => void;
  onSendEmail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[msg.category];
  const pri = PRIORITY_CONFIG[msg.priority];

  return (
    <TouchableOpacity style={[styles.card, msg.priority === 'urgent' && styles.urgentCard]} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={[styles.categoryDot, { backgroundColor: cat.color }]}>
          <Text style={styles.categoryIcon}>{cat.icon}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.subjectRow}>
            <Text style={styles.subject} numberOfLines={expanded ? undefined : 1}>{msg.subject}</Text>
            {msg.priority === 'urgent' && <Text style={[styles.priBadge, { color: pri.color, backgroundColor: pri.color + '18' }]}>{pri.label}</Text>}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Clock color={Colors.text.tertiary} size={10} />
            <Text style={styles.metaText}>{formatTime(msg.sentAt)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Send color={Colors.text.tertiary} size={10} />
            <Text style={styles.metaText}>{msg.recipients.join(', ')}</Text>
          </View>
        </View>
        {expanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
      </View>

      {expanded && (
        <View style={styles.expandedBody}>
          <Text style={styles.bodyText}>{msg.body}</Text>
          {msg.sceneNumber && <Text style={styles.sceneTag}>Scene {msg.sceneNumber}</Text>}
          <View style={styles.expandedActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.actionBtn} onPress={onSendText}>
              <Send color={Colors.status.active} size={14} />
              <Text style={[styles.actionBtnText, { color: Colors.status.active }]}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.actionBtn} onPress={onSendEmail}>
              <Megaphone color={Colors.status.active} size={14} />
              <Text style={[styles.actionBtnText, { color: Colors.status.active }]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.actionBtn} onPress={onShare}>
              <Share2 color={Colors.accent.gold} size={14} />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.actionBtn} onPress={onDelete}>
              <Trash2 color="#EF4444" size={14} />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CommsHubScreen() {
  const { activeProjectId, deleteMessage } = useProjects();
  const messages = useProjectMessages(activeProjectId);
  const crew = useProjectCrew(activeProjectId);
  const router = useGuardedRouter();
  const { isTablet, contentPadding } = useLayout();

  const [filter, setFilter] = useState<'all' | MessageCategory>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return messages;
    return messages.filter(m => m.category === filter);
  }, [messages, filter]);

  const handleDelete = (msg: DirectorMessage) => {
    Alert.alert('Delete Message', `Delete "${msg.subject}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(msg.id) },
    ]);
  };

  /*
   * Actually send it.
   *
   * Both channels open the platform's own composer prefilled: the director
   * still presses send, which is the honest arrangement — Mise has no server to
   * send from, and a crew member should see a message from their director's
   * number rather than from an app.
   *
   * Nothing is opened before the director has been told who this reaches. The
   * failure #42 describes is believing a safety notice went out; a silent send
   * to four of twelve people is the same failure wearing a success message.
   */
  const handleSend = async (msg: DirectorMessage, channel: 'text' | 'email') => {
    const audience = resolveAudience(msg.recipients, crew as Contactable[]);
    const reachable = channel === 'text' ? audience.withPhone : audience.withEmail;

    if (audience.unknownLabels.length > 0) {
      Alert.alert(
        'Unknown recipients',
        `This message is addressed to ${audience.unknownLabels.join(', ')}, which matches no department. Edit the message or add crew to a department first.`);
      return;
    }

    if (reachable.length === 0) {
      Alert.alert('Nobody to send to', describeAudience(audience, channel));
      return;
    }

    const missing = audience.people.length - reachable.length;
    const warning = missing > 0
      ? `\n\nNot included: ${audience.unreachable.concat(
          audience.people.filter(p => !reachable.includes(p) && !audience.unreachable.includes(p)),
        ).map(p => p.name).join(', ')}`
      : '';

    Alert.alert(
      channel === 'text' ? 'Send as a text?' : 'Send as an email?',
      `${describeAudience(audience, channel)}${warning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: channel === 'text' ? 'Open Messages' : 'Open Mail',
          onPress: () => void deliver(msg, channel, audience),
        },
      ]);
  };

  const deliver = async (
    msg: DirectorMessage,
    channel: 'text' | 'email',
    audience: ReturnType<typeof resolveAudience>,
  ) => {
    const body = composeBody(msg);
    try {
      if (channel === 'text') {
        if (!(await SMS.isAvailableAsync())) {
          Alert.alert('Texting unavailable', 'This device cannot send text messages.');
          return;
        }
        await SMS.sendSMSAsync(phoneNumbers(audience), body);
        return;
      }

      const addresses = emailAddresses(audience);
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({ recipients: addresses, subject: msg.subject, body });
        return;
      }
      /* No mail account configured — mailto still reaches whatever handles it. */
      const url = mailtoUrl(addresses, msg.subject, body);
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Email unavailable', 'No mail app is set up on this device.');
    } catch (e) {
      console.warn('[comms-hub] send failed:', e);
      Alert.alert('Could not send', 'The composer did not open. Please try again.');
    }
  };

  const handleShare = async (msg: DirectorMessage) => {
    const pri = msg.priority === 'urgent' ? '🔴 URGENT: ' : '';
    const text = `${pri}${msg.subject}\n\n${msg.body}\n\nTo: ${msg.recipients.join(', ')}`;
    try {
      await Share.share({ message: text });
    } catch (e) {}
  };

  // Stats
  const totalToday = messages.filter(m => {
    const d = new Date(m.sentAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const urgentCount = messages.filter(m => m.priority === 'urgent').length;

  const filters: { key: 'all' | MessageCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'moving-on', label: 'Moving On' },
    { key: 'pickup', label: 'Pickups' },
    { key: 'schedule-change', label: 'Schedule' },
    // Was missing entirely: the one category worth pulling up fast could not be
    // filtered for (#42).
    { key: 'safety', label: 'Safety' },
    { key: 'creative', label: 'Creative' },
    { key: 'general', label: 'General' },
  ];

  return (
    <PermissionGate resource="messages">
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MessageCard
            msg={item}
            onDelete={() => handleDelete(item)}
            onShare={() => handleShare(item)}
            onSendText={() => handleSend(item, 'text')}
            onSendEmail={() => handleSend(item, 'email')}
          />
        )}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Stats */}
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{messages.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalToday}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, urgentCount > 0 && { color: '#EF4444' }]}>{urgentCount}</Text>
                <Text style={styles.statLabel}>Urgent</Text>
              </View>
            </View>

            {/* Filters */}
            <FlatList
              horizontal
              data={filters}
              keyExtractor={f => f.key}
              renderItem={({ item: f }) => (
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Megaphone color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Send quick updates to your crew</Text>
          </View>
        }
      />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Write a message"
        style={styles.fab}
        onPress={() => router.push('/new-message' as never)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border.subtle, justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text.primary },
  statLabel: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border.subtle },
  filterRow: { gap: 8, marginBottom: 16, paddingRight: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.accent.gold },
  card: {
    backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  urgentCard: { borderColor: '#EF444444', borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  categoryDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  categoryIcon: { fontSize: 13, color: '#fff', fontWeight: '700' },
  cardInfo: { flex: 1 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  subject: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  priBadge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  catLabel: { fontSize: 12, fontWeight: '600' },
  metaDot: { color: Colors.text.tertiary, fontSize: 12 },
  metaText: { fontSize: 12, color: Colors.text.tertiary },
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  bodyText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20, marginBottom: 8 },
  sceneTag: { fontSize: 12, color: Colors.accent.gold, fontWeight: '600', marginBottom: 8 },
  expandedActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.accent.gold },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
});
