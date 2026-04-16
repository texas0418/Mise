import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FileText, Upload, Check } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { pickPDF, uploadPDFToSupabase, PickedPDF } from '@/utils/scriptPicker';
import Colors from '@/constants/colors';
import { ScriptRevisionColor } from '@/types';

// ---------------------------------------------------------------------------
// Revision color options (industry standard order)
// ---------------------------------------------------------------------------
const REVISION_OPTIONS: { value: ScriptRevisionColor; label: string; bg: string; text: string }[] = [
  { value: 'white',     label: 'White',     bg: '#FFFFFF',  text: '#000000' },
  { value: 'blue',      label: 'Blue',      bg: '#A8C8E8',  text: '#1A3A5C' },
  { value: 'pink',      label: 'Pink',      bg: '#F4B8C8',  text: '#6B1E34' },
  { value: 'yellow',    label: 'Yellow',    bg: '#FDE68A',  text: '#713F12' },
  { value: 'green',     label: 'Green',     bg: '#A7F3D0',  text: '#064E3B' },
  { value: 'goldenrod', label: 'Goldenrod', bg: '#DAA520',  text: '#3B2A04' },
  { value: 'buff',      label: 'Buff',      bg: '#F5DEB3',  text: '#5C4A1E' },
  { value: 'salmon',    label: 'Salmon',    bg: '#FA8072',  text: '#5C1A12' },
  { value: 'cherry',    label: 'Cherry',    bg: '#DE3163',  text: '#FFFFFF' },
];

export default function NewScriptScreen() {
  const router = useRouter();
  const { activeProjectId, addScriptPDF } = useProjects();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [colorCode, setColorCode] = useState<ScriptRevisionColor>('white');
  const [pickedPDF, setPickedPDF] = useState<PickedPDF | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // ---------------------------------------------------------------------------
  // Pick PDF
  // ---------------------------------------------------------------------------
  const handlePickPDF = async () => {
    const pdf = await pickPDF();
    if (pdf) {
      setPickedPDF(pdf);
      // Auto-fill title from filename if empty
      if (!title.trim()) {
        const nameWithoutExt = pdf.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
        setTitle(nameWithoutExt);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Save — upload PDF to Supabase, then create ScriptPDF record
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!pickedPDF) {
      Alert.alert('No PDF', 'Please select a PDF file first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for this script.');
      return;
    }
    if (!activeProjectId || !user?.id) {
      Alert.alert('Error', 'No active project or not signed in.');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading PDF...');

    try {
      // 1. Upload to Supabase Storage
      const filePath = await uploadPDFToSupabase(pickedPDF, activeProjectId, user.id);
      if (!filePath) {
        setUploading(false);
        setUploadProgress('');
        return; // uploadPDFToSupabase already showed an alert
      }

      setUploadProgress('Saving...');

      // 2. Create local ScriptPDF record (syncs to Supabase via sync engine)
      const now = new Date().toISOString();
      addScriptPDF({
        id: Date.now().toString(),
        projectId: activeProjectId,
        userId: user.id,
        title: title.trim(),
        filePath,
        fileSize: pickedPDF.size,
        pageCount: 0, // We'll update this when the PDF viewer loads and reports page count
        version: version.trim() || undefined,
        colorCode,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      setUploading(false);
      setUploadProgress('');
      router.back();
    } catch (e: any) {
      setUploading(false);
      setUploadProgress('');
      Alert.alert('Error', e.message || 'Failed to upload script.');
    }
  };

  const fileSizeMB = pickedPDF?.size ? (pickedPDF.size / 1024 / 1024).toFixed(1) : null;
  const canSave = !!pickedPDF && !!title.trim() && !uploading;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Upload Script' }} />

      {/* PDF Picker */}
      <Text style={styles.label}>PDF File *</Text>
      {pickedPDF ? (
        <View style={styles.pdfPreview}>
          <View style={styles.pdfPreviewIcon}>
            <FileText color={Colors.accent.gold} size={28} />
          </View>
          <View style={styles.pdfPreviewInfo}>
            <Text style={styles.pdfPreviewName} numberOfLines={1}>
              {pickedPDF.name}
            </Text>
            {fileSizeMB && (
              <Text style={styles.pdfPreviewSize}>{fileSizeMB} MB</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.changePdfBtn}
            onPress={handlePickPDF}
            disabled={uploading}
          >
            <Text style={styles.changePdfText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.pickPdfBtn} onPress={handlePickPDF}>
          <Upload color={Colors.accent.gold} size={28} />
          <Text style={styles.pickPdfText}>Choose PDF from Files</Text>
          <Text style={styles.pickPdfHint}>Maximum 50 MB</Text>
        </TouchableOpacity>
      )}

      {/* Title */}
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder='e.g. "Shooting Script" or "Blue Revision"'
        placeholderTextColor={Colors.text.tertiary}
        editable={!uploading}
      />

      {/* Version */}
      <Text style={styles.label}>Version</Text>
      <TextInput
        style={styles.input}
        value={version}
        onChangeText={setVersion}
        placeholder="e.g. Draft 3, Final, Shooting Script"
        placeholderTextColor={Colors.text.tertiary}
        editable={!uploading}
      />

      {/* Revision Color */}
      <Text style={styles.label}>Revision Color</Text>
      <View style={styles.colorGrid}>
        {REVISION_OPTIONS.map((opt) => {
          const isSelected = colorCode === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.colorOption,
                { backgroundColor: opt.bg },
                isSelected && styles.colorOptionSelected,
              ]}
              onPress={() => setColorCode(opt.value)}
              activeOpacity={0.7}
              disabled={uploading}
            >
              {isSelected && (
                <Check color={opt.text} size={12} strokeWidth={3} />
              )}
              <Text
                style={[styles.colorOptionText, { color: opt.text }]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!canSave}
        activeOpacity={0.8}
      >
        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator color={Colors.text.inverse} size="small" />
            <Text style={styles.saveBtnText}>{uploadProgress}</Text>
          </View>
        ) : (
          <Text style={styles.saveBtnText}>Upload Script</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text.primary,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },

  // PDF picker — empty state
  pickPdfBtn: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  pickPdfText: {
    fontSize: 14,
    color: Colors.accent.gold,
    fontWeight: '600' as const,
  },
  pickPdfHint: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // PDF picker — file selected
  pdfPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '44',
  },
  pdfPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPreviewInfo: { flex: 1 },
  pdfPreviewName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  pdfPreviewSize: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  changePdfBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg.input,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  changePdfText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
  },

  // Revision color grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: Colors.accent.gold,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  colorOptionText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },

  // Save / Upload button
  saveBtn: {
    backgroundColor: Colors.accent.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
