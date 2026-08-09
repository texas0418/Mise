/**
 * components/ImportToolbar.tsx
 *
 * The import affordances, in the layout rather than floating over it.
 *
 * Both buttons used to be dropped into an absolutely positioned wrapper by the
 * wire-import-buttons codemods and never laid out afterwards, so they sat on
 * top of the stats row in Shots and over the notification card in Schedule
 * (#44). Here they are a normal right-aligned row that content flows around,
 * side by side rather than stacked, well clear of the FAB at the bottom.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import ImportButton from '@/components/ImportButton';
import Colors from '@/constants/colors';

export default function ImportToolbar({ entityKey }: { entityKey: string }) {
  return (
    <View style={styles.row} testID={`import-toolbar-${entityKey}`}>
      <ImportButton entityKey={entityKey} variant="compact" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.bg.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
});
