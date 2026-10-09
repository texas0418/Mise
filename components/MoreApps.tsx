// components/MoreApps.tsx
// The "More from Simon Shih" group on the More tab. Three sibling apps, each
// opening its App Store page. Styled to match the settingsGroup/settingsRow
// pattern already on that screen so it reads as part of it.
//
// No network: the list is static data from lib/moreApps.

import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { FleetApp, relatedApps, storeUrl } from '@/lib/moreApps';

export default function MoreApps() {
  const apps = relatedApps();
  if (apps.length === 0) return null;

  const open = (app: FleetApp) => {
    // openURL rejects when nothing can handle the scheme; nothing useful to say.
    Linking.openURL(storeUrl(app)).catch(() => {});
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>More from Simon Shih</Text>
      <View style={styles.settingsGroup}>
        {apps.map((app, i) => (
          <TouchableOpacity
            key={app.key}
            style={i === apps.length - 1 ? styles.rowLast : styles.row}
            onPress={() => open(app)}
            accessibilityRole="link"
            accessibilityLabel={`${app.name}, ${app.line}. Opens the App Store.`}
          >
            <ExternalLink size={18} color={Colors.text.tertiary} />
            <View style={styles.text}>
              <Text style={styles.name}>{app.name}</Text>
              <Text style={styles.line}>{app.line}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  settingsGroup: {
    backgroundColor: Colors.bg.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    marginBottom: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  rowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  text: { flex: 1 },
  name: { fontSize: 14, color: Colors.text.primary },
  line: { fontSize: 12, lineHeight: 16, color: Colors.text.secondary, marginTop: 2 },
});
