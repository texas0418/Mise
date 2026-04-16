/**
 * app/import-data.tsx
 * 
 * Spreadsheet Import Flow Screen for Mise App
 * Phase 2, Item 5
 * 
 * A modal screen with 3 steps:
 * (a) Pick file via document picker
 * (b) Preview parsed data with column→field mapping UI
 * (c) Validate & confirm import with error highlighting
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, Download,
  AlertCircle, ChevronDown, CheckCircle2, Columns, RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLayout } from '@/utils/useLayout';
import { useProjects } from '@/contexts/ProjectContext';
import { pickAndParseSpreadsheet, ParsedSpreadsheet } from '@/utils/spreadsheetParser';
import { autoMapColumns, updateMapping, convertRows, ColumnMapping, MappingResult, FieldDefinition } from '@/utils/fieldMapper';
import { getEntityConfig, EntityConfig } from '@/utils/importRegistry';
import { shareCSVTemplate } from '@/utils/csvTemplates';
import { recordImport } from '@/utils/importHistory';

type Step = 'pick' | 'map' | 'confirm';

export default function ImportDataScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entity?: string }>();
  const { isTablet, contentPadding } = useLayout();
  const projects = useProjects();

  const entityKey = params.entity ?? '';
  const entityConfig = getEntityConfig(entityKey);

  const [step, setStep] = useState<Step>('pick');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

  // ─── Step 1: Pick File ─────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pickAndParseSpreadsheet();

      if (!result.success) {
        if (result.error.type !== 'pick_cancelled') {
          Alert.alert('Import Error', result.error.message);
        }
        setLoading(false);
        return;
      }

      setParsedData(result.data);

      // Auto-map columns
      if (entityConfig) {
        const mapping = autoMapColumns(result.data.headers, entityConfig.fields);
        setMappingResult(mapping);
      }

      setStep('map');
    } catch (err) {
      Alert.alert('Error', 'Failed to read the file. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [entityConfig]);

  // ─── Step 2: Update Mapping ────────────────────────────────────

  const handleUpdateMapping = useCallback((columnIndex: number, fieldKey: string | null) => {
    if (!mappingResult || !entityConfig) return;
    const updated = updateMapping(mappingResult, columnIndex, fieldKey, entityConfig.fields);
    setMappingResult(updated);
    setExpandedColumn(null);
  }, [mappingResult, entityConfig]);

  // ─── Step 3: Confirm Import ────────────────────────────────────

  const convertedRows = useMemo(() => {
    if (!parsedData || !mappingResult || !entityConfig) return [];
    return convertRows(parsedData.rows, mappingResult.mappings, entityConfig.fields);
  }, [parsedData, mappingResult, entityConfig]);

  const handleConfirmImport = useCallback(async () => {
    if (!entityConfig || !parsedData || !mappingResult || convertedRows.length === 0) return;

    setImporting(true);
    try {
      const projectId = projects.activeProjectId ?? '1';
      const addFn = (projects as Record<string, unknown>)[entityConfig.addMethod] as ((item: Record<string, unknown>) => void) | undefined;

      if (!addFn) {
        Alert.alert('Error', `Import method "${entityConfig.addMethod}" not found.`);
        setImporting(false);
        return;
      }

      let itemsWithMeta: Record<string, unknown>[] | null = null;

      // Check for addBulk first, fall back to individual adds
      const bulkAddFn = (projects as Record<string, unknown>)[entityConfig.addMethod + 'Bulk'] as ((items: Record<string, unknown>[]) => void) | undefined;

      if (bulkAddFn) {
        // Use bulk add if available
        itemsWithMeta = convertedRows.map((row, i) => ({
          id: `import-${Date.now()}-${i}`,
          projectId,
          ...row,
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        }));
        bulkAddFn(itemsWithMeta);
      } else {
        // Fall back to individual adds
        for (let i = 0; i < convertedRows.length; i++) {
          const row = convertedRows[i];
          const item = {
            id: `import-${Date.now()}-${i}`,
            projectId,
            ...row,
            createdAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
          };
          addFn(item as Record<string, unknown>);
          // Small delay to avoid overwhelming AsyncStorage
          if (i % 10 === 9) {
            await new Promise(r => setTimeout(r, 50));
          }
        }
      }

      // Record import for undo
      const importedIds = itemsWithMeta
        ? itemsWithMeta.map((item: Record<string, unknown>) => item.id as string)
        : convertedRows.map((_, i) => `import-${Date.now()}-${i}`);
      await recordImport({
        entityKey: entityConfig.key,
        entityLabel: entityConfig.label,
        itemIds: importedIds,
        count: convertedRows.length,
        method: 'spreadsheet',
        fileName: parsedData?.fileName,
      });

      Alert.alert(
        'Import Complete',
        `Successfully imported ${convertedRows.length} ${entityConfig.label.toLowerCase()}.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Import Failed', msg);
    } finally {
      setImporting(false);
    }
  }, [entityConfig, parsedData, mappingResult, convertedRows, projects, router]);

  // ─── No Entity Config ──────────────────────────────────────────

  if (!entityConfig) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Import Data' }} />
        <View style={styles.errorContainer}>
          <AlertCircle color={Colors.status.error} size={48} />
          <Text style={styles.errorTitle}>Unknown Entity Type</Text>
          <Text style={styles.errorSubtitle}>This data type does not support import.</Text>
        </View>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: 'modal', title: `Import ${entityConfig.label}` }} />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <StepIndicator step={1} label="File" active={step === 'pick'} done={step !== 'pick'} />
        <View style={[styles.progressLine, step !== 'pick' && styles.progressLineDone]} />
        <StepIndicator step={2} label="Map" active={step === 'map'} done={step === 'confirm'} />
        <View style={[styles.progressLine, step === 'confirm' && styles.progressLineDone]} />
        <StepIndicator step={3} label="Import" active={step === 'confirm'} done={false} />
      </View>

      {step === 'pick' && (
        <PickStep
          entityConfig={entityConfig}
          loading={loading}
          onPickFile={handlePickFile}
        />
      )}

      {step === 'map' && parsedData && mappingResult && (
        <MapStep
          parsedData={parsedData}
          mappingResult={mappingResult}
          entityConfig={entityConfig}
          expandedColumn={expandedColumn}
          onExpandColumn={setExpandedColumn}
          onUpdateMapping={handleUpdateMapping}
          onBack={() => { setStep('pick'); setParsedData(null); setMappingResult(null); }}
          onNext={() => setStep('confirm')}
          isTablet={isTablet}
          contentPadding={contentPadding}
        />
      )}

      {step === 'confirm' && parsedData && mappingResult && (
        <ConfirmStep
          parsedData={parsedData}
          mappingResult={mappingResult}
          entityConfig={entityConfig}
          convertedRows={convertedRows}
          importing={importing}
          onBack={() => setStep('map')}
          onConfirm={handleConfirmImport}
          isTablet={isTablet}
          contentPadding={contentPadding}
        />
      )}
    </View>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────

function StepIndicator({ step, label, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <View style={styles.stepIndicator}>
      <View style={[
        styles.stepCircle,
        active && styles.stepCircleActive,
        done && styles.stepCircleDone,
      ]}>
        {done ? (
          <Check color={Colors.bg.primary} size={14} />
        ) : (
          <Text style={[styles.stepNumber, (active || done) && styles.stepNumberActive]}>{step}</Text>
        )}
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

// ─── Step 1: Pick File ───────────────────────────────────────────

function PickStep({ entityConfig, loading, onPickFile }: {
  entityConfig: EntityConfig;
  loading: boolean;
  onPickFile: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <View style={styles.pickContainer}>
        <View style={styles.pickIconWrap}>
          <FileSpreadsheet color={Colors.accent.gold} size={48} />
        </View>
        <Text style={styles.pickTitle}>Import {entityConfig.label}</Text>
        <Text style={styles.pickSubtitle}>
          Select a CSV, TSV, or Excel file from your device.{'\n'}
          The first row should contain column headers.
        </Text>

        <TouchableOpacity
          style={styles.pickButton}
          onPress={onPickFile}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <>
              <Upload color={Colors.text.inverse} size={20} />
              <Text style={styles.pickButtonText}>Choose File</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Supported formats */}
        <View style={styles.formatsRow}>
          {['CSV', 'TSV', 'XLSX', 'XLS'].map(fmt => (
            <View key={fmt} style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>.{fmt.toLowerCase()}</Text>
            </View>
          ))}
        </View>

        {/* Download template */}
        <TouchableOpacity
          style={styles.templateBtn}
          onPress={() => shareCSVTemplate(entityConfig.key).catch(e =>
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not share template')
          )}
          activeOpacity={0.7}
        >
          <Download color={Colors.accent.gold} size={14} />
          <Text style={styles.templateBtnText}>Download CSV Template</Text>
        </TouchableOpacity>

        {/* Field info */}
        <View style={styles.fieldsInfoCard}>
          <Text style={styles.fieldsInfoTitle}>Expected Columns</Text>
          <View style={styles.fieldsInfoList}>
            {entityConfig.fields.filter(f => f.required).map(f => (
              <View key={f.key} style={styles.fieldInfoRow}>
                <View style={[styles.fieldDot, { backgroundColor: Colors.status.error }]} />
                <Text style={styles.fieldInfoText}>{f.label}</Text>
                <Text style={styles.fieldRequired}>Required</Text>
              </View>
            ))}
            {entityConfig.fields.filter(f => !f.required).slice(0, 5).map(f => (
              <View key={f.key} style={styles.fieldInfoRow}>
                <View style={[styles.fieldDot, { backgroundColor: Colors.text.tertiary }]} />
                <Text style={styles.fieldInfoText}>{f.label}</Text>
              </View>
            ))}
            {entityConfig.fields.filter(f => !f.required).length > 5 && (
              <Text style={styles.fieldsMore}>
                +{entityConfig.fields.filter(f => !f.required).length - 5} more optional fields
              </Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Step 2: Map Columns ─────────────────────────────────────────

function MapStep({ parsedData, mappingResult, entityConfig, expandedColumn, onExpandColumn, onUpdateMapping, onBack, onNext, isTablet, contentPadding }: {
  parsedData: ParsedSpreadsheet;
  mappingResult: MappingResult;
  entityConfig: EntityConfig;
  expandedColumn: number | null;
  onExpandColumn: (idx: number | null) => void;
  onUpdateMapping: (columnIndex: number, fieldKey: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  isTablet: boolean;
  contentPadding: number;
}) {
  const mappedCount = mappingResult.mappings.filter(m => m.mappedField !== null).length;
  const totalFields = entityConfig.fields.length;

  return (
    <View style={styles.flex1}>
      {/* File info bar */}
      <View style={styles.fileInfoBar}>
        <FileSpreadsheet color={Colors.accent.gold} size={16} />
        <Text style={styles.fileInfoName} numberOfLines={1}>{parsedData.fileName}</Text>
        <Text style={styles.fileInfoMeta}>{parsedData.rowCount} rows · {parsedData.columnCount} cols</Text>
      </View>

      {/* Mapping stats */}
      <View style={styles.mappingStats}>
        <Text style={styles.mappingStatsText}>
          {mappedCount} of {parsedData.columnCount} columns mapped
        </Text>
        {!mappingResult.isValid && (
          <View style={styles.warningBadge}>
            <AlertCircle color={Colors.status.warning} size={12} />
            <Text style={styles.warningText}>
              {mappingResult.missingRequired.length} required field{mappingResult.missingRequired.length > 1 ? 's' : ''} unmapped
            </Text>
          </View>
        )}
      </View>

      {/* Column mapping list */}
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.mapList, {
        paddingHorizontal: contentPadding,
        maxWidth: isTablet ? 800 : undefined,
        alignSelf: isTablet ? 'center' as const : undefined,
        width: isTablet ? '100%' : undefined,
      }]}>
        {mappingResult.mappings.map((mapping) => (
          <ColumnMappingCard
            key={mapping.columnIndex}
            mapping={mapping}
            entityConfig={entityConfig}
            previewValues={parsedData.rows.slice(0, 3).map(r => r[mapping.columnIndex] ?? '')}
            isExpanded={expandedColumn === mapping.columnIndex}
            unmappedFields={mappingResult.unmappedFields}
            onToggleExpand={() => onExpandColumn(expandedColumn === mapping.columnIndex ? null : mapping.columnIndex)}
            onSelectField={(fieldKey) => onUpdateMapping(mapping.columnIndex, fieldKey)}
          />
        ))}

        {/* Unmapped required fields warning */}
        {mappingResult.missingRequired.length > 0 && (
          <View style={styles.missingCard}>
            <AlertCircle color={Colors.status.error} size={18} />
            <View style={styles.missingCardBody}>
              <Text style={styles.missingCardTitle}>Missing Required Fields</Text>
              {mappingResult.missingRequired.map(f => (
                <Text key={f.key} style={styles.missingFieldText}>• {f.label}</Text>
              ))}
              <Text style={styles.missingHint}>Expand a column above and assign it to a required field</Text>
            </View>
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
          style={[styles.nextBtn, !mappingResult.isValid && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={!mappingResult.isValid}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>Preview Import</Text>
          <ArrowRight color={Colors.text.inverse} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Column Mapping Card ─────────────────────────────────────────

function ColumnMappingCard({ mapping, entityConfig, previewValues, isExpanded, unmappedFields, onToggleExpand, onSelectField }: {
  mapping: ColumnMapping;
  entityConfig: EntityConfig;
  previewValues: string[];
  isExpanded: boolean;
  unmappedFields: FieldDefinition[];
  onToggleExpand: () => void;
  onSelectField: (fieldKey: string | null) => void;
}) {
  const matchedField = mapping.mappedField
    ? entityConfig.fields.find(f => f.key === mapping.mappedField)
    : null;

  const confidenceColor = mapping.confidence >= 0.8
    ? Colors.status.active
    : mapping.confidence >= 0.5
      ? Colors.status.warning
      : Colors.text.tertiary;

  return (
    <View style={[styles.mappingCard, isExpanded && styles.mappingCardExpanded]}>
      <TouchableOpacity style={styles.mappingCardHeader} onPress={onToggleExpand} activeOpacity={0.7}>
        {/* Left: column info */}
        <View style={styles.mappingLeft}>
          <Columns color={Colors.text.tertiary} size={14} />
          <Text style={styles.columnHeaderText} numberOfLines={1}>{mapping.columnHeader}</Text>
        </View>

        {/* Center: arrow + mapped field */}
        <View style={styles.mappingCenter}>
          <ArrowRight color={Colors.text.tertiary} size={14} />
          {matchedField ? (
            <View style={[styles.mappedFieldBadge, { borderColor: confidenceColor + '44', backgroundColor: confidenceColor + '12' }]}>
              <Text style={[styles.mappedFieldText, { color: confidenceColor }]}>{matchedField.label}</Text>
            </View>
          ) : (
            <Text style={styles.unmappedText}>Not mapped</Text>
          )}
        </View>

        <ChevronDown color={Colors.text.tertiary} size={16} style={isExpanded ? { transform: [{ rotate: '180deg' }] } : undefined} />
      </TouchableOpacity>

      {/* Preview values */}
      {!isExpanded && previewValues.filter(v => v).length > 0 && (
        <View style={styles.previewRow}>
          {previewValues.filter(v => v).slice(0, 2).map((val, i) => (
            <Text key={i} style={styles.previewValue} numberOfLines={1}>"{val}"</Text>
          ))}
        </View>
      )}

      {/* Expanded: field selector */}
      {isExpanded && (
        <View style={styles.fieldSelector}>
          <Text style={styles.fieldSelectorTitle}>Assign to field:</Text>

          {/* Current mapping — option to unmap */}
          {mapping.mappedField && (
            <TouchableOpacity
              style={styles.fieldOption}
              onPress={() => onSelectField(null)}
              activeOpacity={0.7}
            >
              <X color={Colors.status.error} size={14} />
              <Text style={[styles.fieldOptionText, { color: Colors.status.error }]}>Don't import this column</Text>
            </TouchableOpacity>
          )}

          {/* Available fields */}
          {[
            // Show currently mapped field first
            ...(matchedField ? [matchedField] : []),
            // Then unmapped fields
            ...unmappedFields,
          ].map(field => {
            const isCurrentlyMapped = mapping.mappedField === field.key;
            return (
              <TouchableOpacity
                key={field.key}
                style={[styles.fieldOption, isCurrentlyMapped && styles.fieldOptionSelected]}
                onPress={() => onSelectField(field.key)}
                activeOpacity={0.7}
              >
                {isCurrentlyMapped ? (
                  <CheckCircle2 color={Colors.accent.gold} size={14} />
                ) : (
                  <View style={styles.fieldOptionDot} />
                )}
                <Text style={[styles.fieldOptionText, isCurrentlyMapped && { color: Colors.accent.gold }]}>
                  {field.label}
                </Text>
                {field.required && <Text style={styles.fieldOptionRequired}>Required</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────

function ConfirmStep({ parsedData, mappingResult, entityConfig, convertedRows, importing, onBack, onConfirm, isTablet, contentPadding }: {
  parsedData: ParsedSpreadsheet;
  mappingResult: MappingResult;
  entityConfig: EntityConfig;
  convertedRows: Record<string, unknown>[];
  importing: boolean;
  onBack: () => void;
  onConfirm: () => void;
  isTablet: boolean;
  contentPadding: number;
}) {
  // Get the mapped field labels for the preview table
  const mappedFields = mappingResult.mappings
    .filter(m => m.mappedField !== null)
    .map(m => {
      const field = entityConfig.fields.find(f => f.key === m.mappedField);
      return { key: m.mappedField!, label: field?.label ?? m.mappedField! };
    });

  const previewFields = mappedFields.slice(0, 4); // Show up to 4 columns in preview

  return (
    <View style={styles.flex1}>
      {/* Summary card */}
      <View style={[styles.summaryCard, { marginHorizontal: contentPadding }]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>File</Text>
          <Text style={styles.summaryValue}>{parsedData.fileName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>{entityConfig.label}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rows to import</Text>
          <Text style={[styles.summaryValue, { color: Colors.accent.gold }]}>{convertedRows.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fields mapped</Text>
          <Text style={styles.summaryValue}>
            {mappingResult.mappings.filter(m => m.mappedField).length} of {entityConfig.fields.length}
          </Text>
        </View>
      </View>

      {/* Preview table */}
      <Text style={[styles.previewTitle, { paddingHorizontal: contentPadding }]}>
        Preview (first 5 rows)
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.previewTable, { marginHorizontal: contentPadding }]}>
          {/* Header row */}
          <View style={styles.previewTableHeader}>
            <View style={styles.previewTableRowNum}>
              <Text style={styles.previewTableHeaderText}>#</Text>
            </View>
            {previewFields.map(f => (
              <View key={f.key} style={styles.previewTableCell}>
                <Text style={styles.previewTableHeaderText} numberOfLines={1}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {convertedRows.slice(0, 5).map((row, i) => (
            <View key={i} style={[styles.previewTableRow, i % 2 === 1 && styles.previewTableRowAlt]}>
              <View style={styles.previewTableRowNum}>
                <Text style={styles.previewTableCellText}>{i + 1}</Text>
              </View>
              {previewFields.map(f => (
                <View key={f.key} style={styles.previewTableCell}>
                  <Text style={styles.previewTableCellText} numberOfLines={1}>
                    {formatPreviewValue(row[f.key])}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.flex1} />

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft color={Colors.text.secondary} size={18} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={onConfirm}
          disabled={importing}
          activeOpacity={0.8}
        >
          {importing ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <>
              <Check color={Colors.text.inverse} size={18} />
              <Text style={styles.confirmBtnText}>
                Import {convertedRows.length} {entityConfig.label}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const str = String(value);
  return str.length > 0 ? str : '—';
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  flex1: { flex: 1 },

  // Progress bar
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24, gap: 0,
    backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  progressLine: { width: 40, height: 2, backgroundColor: Colors.border.subtle, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: Colors.accent.gold },
  stepIndicator: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg.elevated, borderWidth: 1.5, borderColor: Colors.border.subtle,
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { borderColor: Colors.accent.gold, backgroundColor: Colors.accent.goldBg },
  stepCircleDone: { borderColor: Colors.accent.gold, backgroundColor: Colors.accent.gold },
  stepNumber: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.tertiary },
  stepNumberActive: { color: Colors.accent.gold },
  stepLabel: { fontSize: 10, fontWeight: '600' as const, color: Colors.text.tertiary },
  stepLabelActive: { color: Colors.accent.gold },

  // Error
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  errorSubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },

  // Step content
  stepContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Pick step
  pickContainer: { alignItems: 'center', gap: 16 },
  pickIconWrap: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.accent.gold + '33',
  },
  pickTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text.primary },
  pickSubtitle: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  pickButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.accent.gold, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28,
    marginTop: 8,
  },
  pickButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  formatsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  formatBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  formatBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.accent.gold + '33',
    marginTop: 4,
  },
  templateBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  fieldsInfoCard: {
    width: '100%', marginTop: 16, padding: 16, borderRadius: 12,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  fieldsInfoTitle: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' as const },
  fieldsInfoList: { gap: 6 },
  fieldInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldDot: { width: 6, height: 6, borderRadius: 3 },
  fieldInfoText: { fontSize: 13, color: Colors.text.secondary, flex: 1 },
  fieldRequired: { fontSize: 10, fontWeight: '600' as const, color: Colors.status.error },
  fieldsMore: { fontSize: 11, color: Colors.text.tertiary, marginTop: 4, fontStyle: 'italic' as const },

  // File info bar
  fileInfoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.accent.goldBg, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  fileInfoName: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: Colors.accent.gold },
  fileInfoMeta: { fontSize: 11, color: Colors.text.tertiary },

  // Mapping stats
  mappingStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  mappingStatsText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' as const },
  warningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: Colors.status.warning + '18',
  },
  warningText: { fontSize: 10, fontWeight: '600' as const, color: Colors.status.warning },

  // Map list
  mapList: { padding: 16, paddingBottom: 100, gap: 8 },

  // Mapping card
  mappingCard: {
    backgroundColor: Colors.bg.card, borderRadius: 12,
    borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden',
  },
  mappingCardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  mappingCardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8,
  },
  mappingLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  columnHeaderText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary, flexShrink: 1 },
  mappingCenter: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  mappedFieldBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5,
  },
  mappedFieldText: { fontSize: 11, fontWeight: '600' as const },
  unmappedText: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic' as const },

  // Preview values
  previewRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
  previewValue: { fontSize: 10, color: Colors.text.tertiary, backgroundColor: Colors.bg.elevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, maxWidth: 120 },

  // Field selector (expanded)
  fieldSelector: {
    paddingHorizontal: 12, paddingBottom: 12, gap: 4,
    borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
    marginTop: 4, paddingTop: 10,
  },
  fieldSelectorTitle: { fontSize: 10, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 4 },
  fieldOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
  },
  fieldOptionSelected: { backgroundColor: Colors.accent.goldBg },
  fieldOptionDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border.medium },
  fieldOptionText: { fontSize: 13, color: Colors.text.secondary, flex: 1 },
  fieldOptionRequired: { fontSize: 9, fontWeight: '700' as const, color: Colors.status.error, textTransform: 'uppercase' as const },

  // Missing required
  missingCard: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12,
    backgroundColor: Colors.status.error + '0A', borderWidth: 1, borderColor: Colors.status.error + '33',
    marginTop: 4,
  },
  missingCardBody: { flex: 1 },
  missingCardTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.status.error, marginBottom: 6 },
  missingFieldText: { fontSize: 12, color: Colors.text.secondary, marginBottom: 2 },
  missingHint: { fontSize: 11, color: Colors.text.tertiary, marginTop: 6, fontStyle: 'italic' as const },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg.secondary, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  backBtnText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' as const },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent.gold, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.status.active, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },

  // Confirm step
  summaryCard: {
    margin: 16, padding: 16, borderRadius: 12,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle, gap: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: Colors.text.secondary },
  summaryValue: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary },

  // Preview table
  previewTitle: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 8, marginTop: 4 },
  previewTable: { borderRadius: 10, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border.subtle },
  previewTableHeader: { flexDirection: 'row', backgroundColor: Colors.bg.elevated },
  previewTableHeaderText: { fontSize: 10, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  previewTableRow: { flexDirection: 'row', backgroundColor: Colors.bg.card },
  previewTableRowAlt: { backgroundColor: Colors.bg.secondary },
  previewTableRowNum: { width: 36, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center' },
  previewTableCell: { width: 120, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center', borderLeftWidth: 0.5, borderLeftColor: Colors.border.subtle },
  previewTableCellText: { fontSize: 12, color: Colors.text.secondary },
});
