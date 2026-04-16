// ---------------------------------------------------------------------------
// components/ConflictResolver.tsx — Shows diff when sync detects a conflict
//
// For most cases, last-write-wins is automatic. This component is used
// when manual resolution is needed (future enhancement).
//
// Usage:
//   <ConflictResolver
//     localVersion={localRecord}
//     remoteVersion={remoteRecord}
//     fields={['title', 'description', 'status']}
//     onResolve={(resolved) => handleResolved(resolved)}
//     onDismiss={() => setShowConflict(false)}
//   />
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { GitMerge, Check, ArrowLeft, ArrowRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Props {
  localVersion: Record<string, any>;
  remoteVersion: Record<string, any>;
  fields: string[];
  onResolve: (resolved: Record<string, any>) => void;
  onDismiss: () => void;
}

export default function ConflictResolver({
  localVersion, remoteVersion, fields, onResolve, onDismiss,
}: Props) {
  // Track which version is selected per field: 'local' or 'remote'
  const [selections, setSelections] = useState<Record<string, 'local' | 'remote'>>(() => {
    const initial: Record<string, 'local' | 'remote'> = {};
    for (const field of fields) {
      // Default to remote (most recent by timestamp)
      const remoteTime = new Date(remoteVersion.updatedAt || 0).getTime();
      const localTime = new Date(localVersion.updatedAt || 0).getTime();
      initial[field] = remoteTime >= localTime ? 'remote' : 'local';
    }
    return initial;
  });

  const toggleField = useCallback((field: string) => {
    setSelections(prev => ({
      ...prev,
      [field]: prev[field] === 'local' ? 'remote' : 'local',
    }));
  }, []);

  const handleKeepLocal = useCallback(() => {
    onResolve({ ...localVersion });
  }, [localVersion, onResolve]);

  const handleKeepRemote = useCallback(() => {
    onResolve({ ...remoteVersion });
  }, [remoteVersion, onResolve]);

  const handleMerge = useCallback(() => {
    const merged = { ...remoteVersion }; // Start with remote as base
    for (const field of fields) {
      if (selections[field] === 'local') {
        merged[field] = localVersion[field];
      }
    }
    merged.updatedAt = new Date().toISOString();
    onResolve(merged);
  }, [selections, localVersion, remoteVersion, fields, onResolve]);

  // Find fields that actually differ
  const diffFields = fields.filter(f =>
    JSON.stringify(localVersion[f]) !== JSON.stringify(remoteVersion[f])
  );

  if (diffFields.length === 0) {
    // No actual conflict — auto-resolve
    onResolve(remoteVersion);
    return null;
  }

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={s.header}>
          <GitMerge color={Colors.status.warning} size={20} />
          <Text style={s.headerTitle}>Sync Conflict</Text>
        </View>
        <Text style={s.headerDesc}>
          This record was edited on two devices. Choose which version to keep for each field.
        </Text>

        <ScrollView style={s.fieldList}>
          {diffFields.map(field => {
            const localVal = String(localVersion[field] ?? '—');
            const remoteVal = String(remoteVersion[field] ?? '—');
            const selected = selections[field];

            return (
              <View key={field} style={s.fieldRow}>
                <Text style={s.fieldName}>{formatFieldName(field)}</Text>
                <View style={s.versions}>
                  <TouchableOpacity
                    style={[s.versionCard, selected === 'local' && s.versionSelected]}
                    onPress={() => toggleField(field)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.versionLabel}>This Device</Text>
                    <Text style={s.versionValue} numberOfLines={2}>{localVal}</Text>
                    {selected === 'local' && <Check color={Colors.accent.gold} size={14} style={s.checkIcon} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.versionCard, selected === 'remote' && s.versionSelected]}
                    onPress={() => toggleField(field)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.versionLabel}>Other Device</Text>
                    <Text style={s.versionValue} numberOfLines={2}>{remoteVal}</Text>
                    {selected === 'remote' && <Check color={Colors.accent.gold} size={14} style={s.checkIcon} />}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity style={s.quickBtn} onPress={handleKeepLocal} activeOpacity={0.7}>
            <ArrowLeft color={Colors.text.secondary} size={14} />
            <Text style={s.quickBtnText}>Keep All Local</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.mergeBtn} onPress={handleMerge} activeOpacity={0.8}>
            <GitMerge color={Colors.text.inverse} size={16} />
            <Text style={s.mergeBtnText}>Merge Selected</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={handleKeepRemote} activeOpacity={0.7}>
            <Text style={s.quickBtnText}>Keep All Remote</Text>
            <ArrowRight color={Colors.text.secondary} size={14} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={s.dismissText}>Dismiss (auto-resolve later)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 100 },
  modal: { backgroundColor: Colors.bg.elevated, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  headerDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: 16 },
  fieldList: { maxHeight: 300 },
  fieldRow: { marginBottom: 14 },
  fieldName: { fontSize: 12, fontWeight: '600', color: Colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  versions: { flexDirection: 'row', gap: 8 },
  versionCard: { flex: 1, backgroundColor: Colors.bg.card, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border.subtle },
  versionSelected: { borderColor: Colors.accent.gold, backgroundColor: Colors.accent.goldBg },
  versionLabel: { fontSize: 10, fontWeight: '600', color: Colors.text.tertiary, marginBottom: 4 },
  versionValue: { fontSize: 13, color: Colors.text.primary },
  checkIcon: { position: 'absolute', top: 6, right: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 10, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  quickBtnText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' },
  mergeBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent.gold, padding: 12, borderRadius: 8 },
  mergeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text.inverse },
  dismissBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  dismissText: { fontSize: 12, color: Colors.text.tertiary },
});
