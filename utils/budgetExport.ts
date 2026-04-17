import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { BudgetItem, BudgetCategory } from '@/types';

// ─── Category ordering & labels ──────────────────────────────────────────────

const CATEGORY_ORDER: BudgetCategory[] = [
  'talent', 'crew', 'equipment', 'locations', 'production-design',
  'catering', 'transport', 'music', 'post-production',
  'marketing', 'legal', 'insurance', 'contingency', 'other',
];

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'talent': 'Talent', 'crew': 'Crew', 'equipment': 'Equipment', 'locations': 'Locations',
  'production-design': 'Production Design', 'post-production': 'Post-Production', 'music': 'Music', 'marketing': 'Marketing',
  'legal': 'Legal', 'insurance': 'Insurance', 'catering': 'Catering', 'transport': 'Transport',
  'contingency': 'Contingency', 'other': 'Other',
};

// ─── Export function ─────────────────────────────────────────────────────────

export async function exportBudgetToXlsx(
  items: BudgetItem[],
  projectTitle: string,
): Promise<void> {
  try {
    // Group by category
    const grouped = new Map<BudgetCategory, BudgetItem[]>();
    items.forEach(item => {
      const arr = grouped.get(item.category) || [];
      arr.push(item);
      grouped.set(item.category, arr);
    });

    // Build rows
    const rows: (string | number)[][] = [];

    // Header
    rows.push([`${projectTitle} — Production Budget`]);
    rows.push([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`]);
    rows.push([]); // blank row
    rows.push(['Category', 'Description', 'Vendor', 'Estimated', 'Actual', 'Variance', 'Paid']);

    let grandEstimated = 0;
    let grandActual = 0;

    CATEGORY_ORDER.forEach(cat => {
      const catItems = grouped.get(cat);
      if (!catItems || catItems.length === 0) return;

      let catEstimated = 0;
      let catActual = 0;

      // Category header row
      rows.push([CATEGORY_LABELS[cat].toUpperCase(), '', '', '', '', '', '']);

      catItems.forEach(item => {
        const variance = item.estimated - item.actual;
        rows.push([
          '',
          item.description,
          item.vendor || '',
          item.estimated,
          item.actual,
          variance,
          item.paid ? 'Yes' : 'No',
        ]);
        catEstimated += item.estimated;
        catActual += item.actual;
      });

      // Category subtotal
      rows.push([
        '',
        `${CATEGORY_LABELS[cat]} Subtotal`,
        '',
        catEstimated,
        catActual,
        catEstimated - catActual,
        '',
      ]);
      rows.push([]); // blank spacer

      grandEstimated += catEstimated;
      grandActual += catActual;
    });

    // Grand total
    rows.push([
      '',
      'GRAND TOTAL',
      '',
      grandEstimated,
      grandActual,
      grandEstimated - grandActual,
      '',
    ]);

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 20 }, // Category
      { wch: 30 }, // Description
      { wch: 18 }, // Vendor
      { wch: 14 }, // Estimated
      { wch: 14 }, // Actual
      { wch: 14 }, // Variance
      { wch: 8 },  // Paid
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');

    // Write to base64
    const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Save to file system
    const safeName = projectTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeName}_Budget.xlsx`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, wbOut, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Check sharing is available
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
      return;
    }

    // Open share sheet
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `${projectTitle} Budget`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  } catch (error) {
    console.error('Budget export error:', error);
    Alert.alert('Export Failed', 'Could not generate the spreadsheet. Please try again.');
  }
}
