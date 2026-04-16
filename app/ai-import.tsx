/**
 * app/ai-import.tsx
 * 
 * AI Import Flow Screen for Mise App
 * Phase 3, Item 10
 * 
 * Modal screen where the user:
 * (a) Types or pastes free-form text describing their data
 * (b) Optionally uploads a photo of a handwritten call sheet / budget sheet
 * (c) Hits "Generate" which calls the Anthropic API
 * (d) Reviews the parsed results in a table
 * (e) Confirms to bulk-import
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Sparkles, Camera, X, Check, ArrowLeft, ArrowRight,
  AlertCircle, Trash2, Key, Image as ImageIcon, Type,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/colors';
import { useLayout } from '@/utils/useLayout';
import { useProjects } from '@/contexts/ProjectContext';
import { getEntityConfig, EntityConfig } from '@/utils/importRegistry';
import { buildAIPrompt, parseAIResponse } from '@/utils/aiImport';
import { sendCompletion, getApiKey, saveApiKey, hasApiKey } from '@/utils/anthropicClient';
import { recordImport } from '@/utils/importHistory';

type Step = 'input' | 'review';

export default function AIImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entity?: string }>();
  const { isTablet, contentPadding } = useLayout();
  const projects = useProjects();

  const entityKey = params.entity ?? '';
  const entityConfig = getEntityConfig(entityKey);

  const [step, setStep] = useState<Step>('input');
  const [userText, setUserText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Check for API key on mount
  useEffect(() => {
    hasApiKey().then(setHasKey);
  }, []);

  // ─── Image Picker ──────────────────────────────────────────────

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      // Get base64 — either from the picker result or read from file
      if (asset.base64) {
        setImageBase64(asset.base64);
      } else {
        try {
          const b64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setImageBase64(b64);
        } catch {
          Alert.alert('Error', 'Could not read the image.');
          setImageUri(null);
        }
      }

      // Detect MIME type
      const ext = asset.uri.split('.').pop()?.toLowerCase();
      if (ext === 'png') setImageMimeType('image/png');
      else if (ext === 'webp') setImageMimeType('image/webp');
      else setImageMimeType('image/jpeg');
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMimeType('image/jpeg');
    }
  }, []);

  // ─── API Key ───────────────────────────────────────────────────

  const handleSaveApiKey = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key.startsWith('sk-ant-')) {
      Alert.alert('Invalid Key', 'Anthropic API keys start with "sk-ant-".');
      return;
    }
    await saveApiKey(key);
    setHasKey(true);
    setShowKeyInput(false);
    setApiKeyInput('');
  }, [apiKeyInput]);

  // ─── Generate ──────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!entityConfig) return;
    if (!userText.trim() && !imageBase64) {
      Alert.alert('Nothing to parse', 'Please enter some text or upload an image.');
      return;
    }

    setGenerating(true);
    try {
      const prompt = buildAIPrompt({
        entityConfig,
        userText: userText.trim(),
        imageBase64: imageBase64 ?? undefined,
        imageMimeType: imageBase64 ? imageMimeType : undefined,
      });

      const rawResponse = await sendCompletion({
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.userMessage }],
      });

      const rows = parseAIResponse(rawResponse);

      if (rows.length === 0) {
        Alert.alert('No Data Found', 'The AI could not extract any data from your input. Try being more specific.');
        setGenerating(false);
        return;
      }

      setParsedRows(rows);
      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('AI Error', msg);
    } finally {
      setGenerating(false);
    }
  }, [entityConfig, userText, imageBase64, imageMimeType]);

  // ─── Confirm Import ────────────────────────────────────────────

  const handleConfirmImport = useCallback(async () => {
    if (!entityConfig || parsedRows.length === 0) return;

    setImporting(true);
    try {
      const projectId = projects.activeProjectId ?? '1';
      const bulkAddFn = (projects as Record<string, unknown>)[entityConfig.addMethod + 'Bulk'] as ((items: Record<string, unknown>[]) => void) | undefined;
      const addFn = (projects as Record<string, unknown>)[entityConfig.addMethod] as ((item: Record<string, unknown>) => void) | undefined;

      const itemsWithMeta = parsedRows.map((row, i) => ({
        id: `ai-import-${Date.now()}-${i}`,
        projectId,
        ...row,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      }));

      if (bulkAddFn) {
        bulkAddFn(itemsWithMeta);
      } else if (addFn) {
        for (const item of itemsWithMeta) {
          addFn(item);
        }
      } else {
        Alert.alert('Error', `Import method not found for ${entityConfig.label}.`);
        setImporting(false);
        return;
      }

      // Record import for undo
      await recordImport({
        entityKey: entityConfig.key,
        entityLabel: entityConfig.label,
        itemIds: itemsWithMeta.map(item => item.id as string),
        count: parsedRows.length,
        method: 'ai',
      });

      Alert.alert(
        'Import Complete',
        `Successfully imported ${parsedRows.length} ${entityConfig.label.toLowerCase()}.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setImporting(false);
    }
  }, [entityConfig, parsedRows, projects, router]);

  // ─── Remove a row ──────────────────────────────────────────────

  const handleRemoveRow = useCallback((index: number) => {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ─── No Entity ─────────────────────────────────────────────────

  if (!entityConfig) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ presentation: 'modal', title: 'AI Import' }} />
        <View style={styles.errorContainer}>
          <AlertCircle color={Colors.status.error} size={48} />
          <Text style={styles.errorTitle}>Unknown Entity Type</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ presentation: 'modal', title: `AI Import ${entityConfig.label}` }} />

      {/* Progress */}
      <View style={styles.progressBar}>
        <StepDot active={step === 'input'} done={step === 'review'} label="Describe" />
        <View style={[styles.progressLine, step === 'review' && styles.progressLineDone]} />
        <StepDot active={step === 'review'} done={false} label="Review" />
      </View>

      {step === 'input' && (
        <InputStep
          entityConfig={entityConfig}
          userText={userText}
          imageUri={imageUri}
          hasKey={hasKey}
          showKeyInput={showKeyInput}
          apiKeyInput={apiKeyInput}
          generating={generating}
          onChangeText={setUserText}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onRemoveImage={() => { setImageUri(null); setImageBase64(null); }}
          onToggleKeyInput={() => setShowKeyInput(!showKeyInput)}
          onChangeApiKey={setApiKeyInput}
          onSaveApiKey={handleSaveApiKey}
          onGenerate={handleGenerate}
          isTablet={isTablet}
          contentPadding={contentPadding}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          entityConfig={entityConfig}
          parsedRows={parsedRows}
          importing={importing}
          onRemoveRow={handleRemoveRow}
          onBack={() => setStep('input')}
          onConfirm={handleConfirmImport}
          isTablet={isTablet}
          contentPadding={contentPadding}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Step Dot ────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive, done && styles.stepCircleDone]}>
        {done ? <Check color={Colors.bg.primary} size={14} /> : (
          <Sparkles color={active ? Colors.accent.gold : Colors.text.tertiary} size={12} />
        )}
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

// ─── Input Step ──────────────────────────────────────────────────

function InputStep({ entityConfig, userText, imageUri, hasKey, showKeyInput, apiKeyInput, generating, onChangeText, onPickImage, onTakePhoto, onRemoveImage, onToggleKeyInput, onChangeApiKey, onSaveApiKey, onGenerate, isTablet, contentPadding }: {
  entityConfig: EntityConfig;
  userText: string;
  imageUri: string | null;
  hasKey: boolean;
  showKeyInput: boolean;
  apiKeyInput: string;
  generating: boolean;
  onChangeText: (text: string) => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onRemoveImage: () => void;
  onToggleKeyInput: () => void;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: () => void;
  onGenerate: () => void;
  isTablet: boolean;
  contentPadding: number;
}) {
  const canGenerate = hasKey && (userText.trim().length > 0 || imageUri !== null);

  return (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.inputContent, {
        paddingHorizontal: contentPadding,
        maxWidth: isTablet ? 700 : undefined,
        alignSelf: isTablet ? 'center' as const : undefined,
        width: isTablet ? '100%' : undefined,
      }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* API Key section */}
      {!hasKey && (
        <View style={styles.keyWarning}>
          <Key color={Colors.status.warning} size={18} />
          <View style={styles.keyWarningBody}>
            <Text style={styles.keyWarningTitle}>API Key Required</Text>
            <Text style={styles.keyWarningText}>
              AI Import uses Claude to parse your data. Add your Anthropic API key to get started.
            </Text>
          </View>
        </View>
      )}

      {(showKeyInput || !hasKey) && (
        <View style={styles.keyInputCard}>
          <Text style={styles.keyInputLabel}>ANTHROPIC API KEY</Text>
          <View style={styles.keyInputRow}>
            <TextInput
              style={styles.keyInput}
              value={apiKeyInput}
              onChangeText={onChangeApiKey}
              placeholder="sk-ant-..."
              placeholderTextColor={Colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.keySaveBtn} onPress={onSaveApiKey} activeOpacity={0.8}>
              <Check color={Colors.text.inverse} size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.keyHint}>Your key is stored locally on this device only.</Text>
        </View>
      )}

      {hasKey && !showKeyInput && (
        <TouchableOpacity style={styles.keyManageRow} onPress={onToggleKeyInput} activeOpacity={0.7}>
          <Key color={Colors.text.tertiary} size={12} />
          <Text style={styles.keyManageText}>API key saved</Text>
          <Text style={styles.keyManageAction}>Change</Text>
        </TouchableOpacity>
      )}

      {/* Hint */}
      <View style={styles.hintCard}>
        <Sparkles color={Colors.accent.gold} size={16} />
        <Text style={styles.hintText}>
          Describe your {entityConfig.label.toLowerCase()} in plain English, paste from a spreadsheet or notes, or snap a photo of a handwritten list.
        </Text>
      </View>

      {/* Text input */}
      <Text style={styles.sectionLabel}>DESCRIBE YOUR DATA</Text>
      <TextInput
        style={styles.textArea}
        value={userText}
        onChangeText={onChangeText}
        placeholder={getPlaceholder(entityConfig)}
        placeholderTextColor={Colors.text.tertiary}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
      />

      {/* Image upload */}
      <Text style={styles.sectionLabel}>OR UPLOAD AN IMAGE</Text>
      {imageUri ? (
        <View style={styles.imagePreview}>
          <View style={styles.imagePreviewInner}>
            <ImageIcon color={Colors.accent.gold} size={20} />
            <Text style={styles.imagePreviewText}>Image attached</Text>
          </View>
          <TouchableOpacity onPress={onRemoveImage} activeOpacity={0.7}>
            <X color={Colors.status.error} size={18} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.imageButtons}>
          <TouchableOpacity style={styles.imageBtn} onPress={onPickImage} activeOpacity={0.7}>
            <ImageIcon color={Colors.accent.gold} size={18} />
            <Text style={styles.imageBtnText}>Photo Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageBtn} onPress={onTakePhoto} activeOpacity={0.7}>
            <Camera color={Colors.accent.gold} size={18} />
            <Text style={styles.imageBtnText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
        onPress={onGenerate}
        disabled={!canGenerate || generating}
        activeOpacity={0.8}
      >
        {generating ? (
          <>
            <ActivityIndicator color={Colors.text.inverse} size="small" />
            <Text style={styles.generateBtnText}>Analyzing with AI...</Text>
          </>
        ) : (
          <>
            <Sparkles color={Colors.text.inverse} size={18} />
            <Text style={styles.generateBtnText}>Generate {entityConfig.label}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Review Step ─────────────────────────────────────────────────

function ReviewStep({ entityConfig, parsedRows, importing, onRemoveRow, onBack, onConfirm, isTablet, contentPadding }: {
  entityConfig: EntityConfig;
  parsedRows: Record<string, unknown>[];
  importing: boolean;
  onRemoveRow: (index: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  isTablet: boolean;
  contentPadding: number;
}) {
  // Pick the first 3-4 required/important fields for the preview
  const previewFields = entityConfig.fields
    .filter(f => f.required)
    .concat(entityConfig.fields.filter(f => !f.required))
    .slice(0, 4);

  return (
    <View style={styles.flex1}>
      {/* Summary */}
      <View style={[styles.reviewSummary, { marginHorizontal: contentPadding }]}>
        <Sparkles color={Colors.accent.gold} size={16} />
        <Text style={styles.reviewSummaryText}>
          AI generated {parsedRows.length} {entityConfig.label.toLowerCase()}
        </Text>
      </View>

      {/* Results list */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.reviewList, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
      >
        {parsedRows.map((row, index) => (
          <View key={index} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardIndex}>#{index + 1}</Text>
              <TouchableOpacity onPress={() => onRemoveRow(index)} activeOpacity={0.7}>
                <Trash2 color={Colors.status.error} size={14} />
              </TouchableOpacity>
            </View>
            {previewFields.map(field => {
              const value = row[field.key];
              if (value === undefined || value === null || value === '') return null;
              return (
                <View key={field.key} style={styles.reviewField}>
                  <Text style={styles.reviewFieldLabel}>{field.label}</Text>
                  <Text style={styles.reviewFieldValue} numberOfLines={2}>
                    {formatValue(value)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {parsedRows.length === 0 && (
          <View style={styles.emptyReview}>
            <Text style={styles.emptyReviewText}>All items removed. Go back to regenerate.</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft color={Colors.text.secondary} size={18} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, parsedRows.length === 0 && styles.confirmBtnDisabled]}
          onPress={onConfirm}
          disabled={importing || parsedRows.length === 0}
          activeOpacity={0.8}
        >
          {importing ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <>
              <Check color={Colors.text.inverse} size={18} />
              <Text style={styles.confirmBtnText}>Import {parsedRows.length} Items</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function getPlaceholder(config: EntityConfig): string {
  const examples: Record<string, string> = {
    crew: 'e.g. "My DP is John Smith, gaffer is Sarah Lee, sound mixer is Mike Chen. Also need to add our PA Maria Garcia and grip Tom Wilson."',
    shots: 'e.g. "Scene 1: Wide establishing shot of the house, then medium on Sarah walking in. Scene 2: Close-up on the letter, OTS of Sarah reading it."',
    budget: 'e.g. "Camera rental from Panavision: $5000. Catering is $200/day for 10 days. Location permit for the park: $500. Sound equipment: $1200."',
    cast: 'e.g. "Jane Doe plays Sarah (lead), confirmed, available March 1-30. Bob Johnson is playing Detective Mills, still in talks, agent is at CAA."',
    locations: 'e.g. "Abandoned warehouse at 123 Industrial Ave, contact Mike 555-0456, needs permit. Also the city park on Main St, free to use, has power."',
    schedule: 'e.g. "Day 1 March 15: Scenes 1,2,5 at Studio A, call time 7am. Day 2 March 16: Scene 3 at the park, call time 6am for sunrise."',
  };
  return examples[config.key] ?? `Describe your ${config.label.toLowerCase()} here...`;
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  flex1: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginTop: 16 },

  // Progress
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
    backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  progressLine: { width: 60, height: 2, backgroundColor: Colors.border.subtle, marginHorizontal: 8 },
  progressLineDone: { backgroundColor: Colors.accent.gold },
  stepIndicator: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg.elevated, borderWidth: 1.5, borderColor: Colors.border.subtle,
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { borderColor: Colors.accent.gold, backgroundColor: Colors.accent.goldBg },
  stepCircleDone: { borderColor: Colors.accent.gold, backgroundColor: Colors.accent.gold },
  stepLabel: { fontSize: 10, fontWeight: '600', color: Colors.text.tertiary },
  stepLabelActive: { color: Colors.accent.gold },

  // Input step
  inputContent: { padding: 16, paddingBottom: 40 },

  // API Key
  keyWarning: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12,
    backgroundColor: Colors.status.warning + '0A', borderWidth: 1, borderColor: Colors.status.warning + '33',
    marginBottom: 12,
  },
  keyWarningBody: { flex: 1 },
  keyWarningTitle: { fontSize: 13, fontWeight: '700', color: Colors.status.warning, marginBottom: 4 },
  keyWarningText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },
  keyInputCard: {
    padding: 14, borderRadius: 12, backgroundColor: Colors.bg.card,
    borderWidth: 0.5, borderColor: Colors.border.subtle, marginBottom: 12,
  },
  keyInputLabel: { fontSize: 9, fontWeight: '700', color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 8 },
  keyInputRow: { flexDirection: 'row', gap: 8 },
  keyInput: {
    flex: 1, backgroundColor: Colors.bg.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  keySaveBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accent.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  keyHint: { fontSize: 10, color: Colors.text.tertiary, marginTop: 8, fontStyle: 'italic' },
  keyManageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: Colors.bg.card, alignSelf: 'flex-start',
  },
  keyManageText: { fontSize: 11, color: Colors.text.tertiary },
  keyManageAction: { fontSize: 11, color: Colors.accent.gold, fontWeight: '600', marginLeft: 4 },

  // Hint
  hintCard: {
    flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10,
    backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '33',
    marginBottom: 16,
  },
  hintText: { flex: 1, fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },

  // Section
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: Colors.text.tertiary,
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },

  // Text area
  textArea: {
    backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14,
    fontSize: 14, color: Colors.text.primary, lineHeight: 20,
    minHeight: 140, borderWidth: 0.5, borderColor: Colors.border.subtle,
    marginBottom: 16,
  },

  // Image buttons
  imageButtons: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  imageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  imageBtnText: { fontSize: 13, fontWeight: '500', color: Colors.accent.gold },
  imagePreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: 10, backgroundColor: Colors.accent.goldBg,
    borderWidth: 0.5, borderColor: Colors.accent.gold + '33', marginBottom: 20,
  },
  imagePreviewInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  imagePreviewText: { fontSize: 13, fontWeight: '500', color: Colors.accent.gold },

  // Generate button
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.accent.gold, borderRadius: 12,
    paddingVertical: 16, marginTop: 4,
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },

  // Review step
  reviewSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.accent.goldBg, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  reviewSummaryText: { fontSize: 13, fontWeight: '600', color: Colors.accent.gold },
  reviewList: { padding: 16, paddingBottom: 100, gap: 8 },
  reviewCard: {
    backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  reviewCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  reviewCardIndex: { fontSize: 11, fontWeight: '700', color: Colors.text.tertiary },
  reviewField: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  reviewFieldLabel: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '600' },
  reviewFieldValue: { fontSize: 12, color: Colors.text.primary, flex: 1, textAlign: 'right' },
  emptyReview: { alignItems: 'center', paddingVertical: 40 },
  emptyReviewText: { fontSize: 14, color: Colors.text.tertiary },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg.secondary, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  backBtnText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.status.active, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text.inverse },
});
