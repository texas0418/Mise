// ---------------------------------------------------------------------------
// components/PermissionGate.tsx — Wraps a screen to enforce role access
//
// Usage:
//   <PermissionGate resource="budget">
//     <BudgetScreen />
//   </PermissionGate>
//
// Shows "no access" if user can't view, "view only" badge if read-only.
// Exposes `canEdit` via render prop pattern for inline checks.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldOff, Eye } from 'lucide-react-native';
import { usePermission } from '@/contexts/PermissionContext';
import type { Resource } from '@/lib/permissions';
import Colors from '@/constants/colors';

interface Props {
  resource: Resource;
  children: React.ReactNode | ((opts: { canEdit: boolean }) => React.ReactNode);
}

export default function PermissionGate({ resource, children }: Props) {
  const { canView, canEdit, role, roleLabel } = usePermission();

  const hasView = canView(resource);
  const hasEdit = canEdit(resource);

  // No access at all
  if (!hasView) {
    return (
      <View style={styles.blocked}>
        <View style={styles.blockedIcon}>
          <ShieldOff color={Colors.text.tertiary} size={40} />
        </View>
        <Text style={styles.blockedTitle}>Access Restricted</Text>
        <Text style={styles.blockedDesc}>
          Your role ({roleLabel}) doesn't have access to this tool.
          Contact the project owner or director to request access.
        </Text>
      </View>
    );
  }

  // Read-only access — render children with view-only badge
  if (!hasEdit) {
    return (
      <View style={styles.container}>
        <View style={styles.viewOnlyBanner}>
          <Eye color={Colors.accent.gold} size={14} />
          <Text style={styles.viewOnlyText}>View Only — {roleLabel}</Text>
        </View>
        {typeof children === 'function' ? children({ canEdit: false }) : children}
      </View>
    );
  }

  // Full write access
  return (
    <>
      {typeof children === 'function' ? children({ canEdit: true }) : children}
    </>
  );
}

// ---------------------------------------------------------------------------
// ViewOnlyBadge — small inline badge for headers or cards
// ---------------------------------------------------------------------------

export function ViewOnlyBadge() {
  return (
    <View style={styles.badge}>
      <Eye color={Colors.accent.gold} size={10} />
      <Text style={styles.badgeText}>View Only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blocked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.bg.primary,
  },
  blockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  blockedDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent.goldBg,
    paddingVertical: 6,
  },
  viewOnlyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.gold,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accent.goldBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.accent.gold,
  },
});
