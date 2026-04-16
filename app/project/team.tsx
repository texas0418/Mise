// app/project/team.tsx — View & manage project team members
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Crown, Shield, ChevronDown, Trash2, User } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectContext';
import { usePermission } from '@/contexts/PermissionContext';
import { supabase } from '@/lib/supabase';
import { ALL_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from '@/lib/permissions';
import Colors from '@/constants/colors';

interface Member {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  acceptedAt: string | null;
  invitedBy: string;
}

export default function TeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeProjectId, activeProject } = useProjects();
  const { canManageMembers, canInvite, role: myRole } = usePermission();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => {
    if (activeProjectId) fetchMembers();
  }, [activeProjectId]);

  const fetchMembers = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('id, user_id, role, accepted_at, invited_by')
        .eq('project_id', activeProjectId)
        .is('deleted_at', null);

      if (error) throw error;

      // Fetch user details for each member
      const memberList: Member[] = [];
      for (const row of data || []) {
        const { data: profile } = await supabase.auth.admin
          ? { data: null } // admin API not available client-side
          : { data: null };

        memberList.push({
          id: row.id,
          userId: row.user_id,
          email: '', // Will be populated by join or separate lookup
          displayName: row.user_id === user?.id ? 'You' : `User ${row.user_id.slice(0, 6)}`,
          role: row.role as Role,
          acceptedAt: row.accepted_at,
          invitedBy: row.invited_by,
        });
      }

      // Add project owner if not in members
      if (activeProject && !memberList.find(m => m.role === 'owner')) {
        memberList.unshift({
          id: 'owner',
          userId: activeProject.id, // approximate
          email: '',
          displayName: 'Project Owner',
          role: 'owner',
          acceptedAt: new Date().toISOString(),
          invitedBy: '',
        });
      }

      setMembers(memberList);
    } catch (e: any) {
      console.warn('[Team] Fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, user]);

  const handleChangeRole = useCallback((memberId: string, memberName: string, currentRole: Role) => {
    const assignableRoles = ALL_ROLES.filter(r => r !== 'owner'); // Can't assign owner

    Alert.alert(
      `Change Role — ${memberName}`,
      `Current: ${ROLE_LABELS[currentRole]}`,
      [
        ...assignableRoles.map(r => ({
          text: ROLE_LABELS[r],
          onPress: async () => {
            setChangingRole(memberId);
            try {
              const { error } = await supabase
                .from('project_members')
                .update({ role: r })
                .eq('id', memberId);
              if (error) throw error;
              await fetchMembers();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setChangingRole(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [fetchMembers]);

  const handleRemoveMember = useCallback((memberId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from this project?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('project_members')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', memberId);
            if (error) throw error;
            await fetchMembers();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }, [fetchMembers]);

  const getRoleIcon = (role: Role) => {
    if (role === 'owner') return <Crown color={Colors.accent.gold} size={16} />;
    if (role === 'director') return <Crown color={Colors.accent.goldLight} size={16} />;
    return <Shield color={Colors.text.tertiary} size={16} />;
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={Colors.accent.gold} size="large" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{activeProject?.title || 'Project'} — Team</Text>
        <Text style={s.subtitle}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Invite button */}
      {canInvite() && (
        <TouchableOpacity
          style={s.inviteButton}
          onPress={() => router.push('/project/invite')}
          activeOpacity={0.8}
        >
          <UserPlus color={Colors.text.inverse} size={18} />
          <Text style={s.inviteButtonText}>Invite Member</Text>
        </TouchableOpacity>
      )}

      {/* Member list */}
      {members.map((member) => {
        const isMe = member.userId === user?.id;
        const isPending = !member.acceptedAt;

        return (
          <View key={member.id} style={s.memberCard}>
            <View style={s.memberHeader}>
              <View style={s.avatar}>
                <User color={Colors.text.tertiary} size={18} />
              </View>
              <View style={s.memberInfo}>
                <Text style={s.memberName}>
                  {member.displayName}
                  {isMe && <Text style={s.youTag}> (you)</Text>}
                </Text>
                {member.email ? <Text style={s.memberEmail}>{member.email}</Text> : null}
                <View style={s.roleRow}>
                  {getRoleIcon(member.role)}
                  <Text style={s.roleText}>{ROLE_LABELS[member.role]}</Text>
                  {isPending && <View style={s.pendingBadge}><Text style={s.pendingText}>Pending</Text></View>}
                </View>
              </View>
            </View>

            {/* Actions — only if I can manage and it's not me or the owner */}
            {canManageMembers() && !isMe && member.role !== 'owner' && (
              <View style={s.memberActions}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => handleChangeRole(member.id, member.displayName, member.role)}
                  activeOpacity={0.7}
                >
                  {changingRole === member.id
                    ? <ActivityIndicator size="small" color={Colors.accent.gold} />
                    : <><ChevronDown color={Colors.accent.gold} size={14} /><Text style={s.actionGold}>Change Role</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => handleRemoveMember(member.id, member.displayName)}
                  activeOpacity={0.7}
                >
                  <Trash2 color={Colors.status.error} size={14} />
                  <Text style={s.actionRed}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* My role info */}
      <View style={s.myRoleCard}>
        <Text style={s.myRoleTitle}>Your Role</Text>
        <Text style={s.myRoleValue}>{ROLE_LABELS[myRole]}</Text>
        <Text style={s.myRoleDesc}>{ROLE_DESCRIPTIONS[myRole]}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.primary },
  header: { marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  subtitle: { fontSize: 13, color: Colors.text.secondary, marginTop: 4 },
  inviteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 14, marginBottom: 20 },
  inviteButtonText: { fontSize: 15, fontWeight: '700', color: Colors.text.inverse },
  memberCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.tertiary, justifyContent: 'center', alignItems: 'center' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  youTag: { fontSize: 12, fontWeight: '400', color: Colors.text.tertiary },
  memberEmail: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  roleText: { fontSize: 12, color: Colors.text.secondary },
  pendingBadge: { backgroundColor: Colors.status.warning + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginLeft: 4 },
  pendingText: { fontSize: 10, fontWeight: '600', color: Colors.status.warning },
  memberActions: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionGold: { fontSize: 13, fontWeight: '500', color: Colors.accent.gold },
  actionRed: { fontSize: 13, fontWeight: '500', color: Colors.status.error },
  myRoleCard: { backgroundColor: Colors.accent.goldBg, borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 0.5, borderColor: Colors.accent.gold + '30' },
  myRoleTitle: { fontSize: 11, fontWeight: '600', color: Colors.accent.gold, textTransform: 'uppercase', letterSpacing: 0.8 },
  myRoleValue: { fontSize: 18, fontWeight: '700', color: Colors.accent.gold, marginTop: 4 },
  myRoleDesc: { fontSize: 13, color: Colors.text.secondary, marginTop: 4, lineHeight: 18 },
});
