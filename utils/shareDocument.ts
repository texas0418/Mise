/**
 * utils/shareDocument.ts
 *
 * Turning built markup or CSV into a file the user can actually send.
 *
 * Filenames matter more than they look: this is the name that lands in
 * someone's inbox, so it carries the film, the document and the date rather
 * than arriving as "document.pdf".
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

/** "The Last Light — Call Sheet Day 3" -> "the-last-light-call-sheet-day-3" */
export function slugify(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'mise-export';
}

function fail(message: string): false {
  Alert.alert('Export failed', message);
  return false;
}

/**
 * Render HTML to a PDF and open the share sheet.
 * Returns false when the export could not be produced or shared.
 */
export async function sharePdf(html: string, baseName: string): Promise<boolean> {
  try {
    const { uri } = await Print.printToFileAsync({ html });

    // printToFileAsync names the file with a random uuid; rename it so the
    // recipient sees what it is.
    const target = `${FileSystem.Paths.cache.uri}${slugify(baseName)}.pdf`;
    let shareUri = uri;
    try {
      const source = new FileSystem.File(uri);
      const dest = new FileSystem.File(target);
      if (dest.exists) dest.delete();
      source.move(dest);
      shareUri = dest.uri;
    } catch {
      // A readable filename is a nicety; never lose the export over it.
    }

    if (!(await Sharing.isAvailableAsync())) {
      return fail('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: baseName,
    });
    return true;
  } catch (e) {
    console.warn('[shareDocument] PDF export failed:', e);
    return fail('Could not create the PDF. Please try again.');
  }
}

/** Write CSV to a file and open the share sheet. */
export async function shareCsv(csv: string, baseName: string): Promise<boolean> {
  try {
    const target = `${FileSystem.Paths.cache.uri}${slugify(baseName)}.csv`;
    const file = new FileSystem.File(target);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    if (!(await Sharing.isAvailableAsync())) {
      return fail('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: baseName,
    });
    return true;
  } catch (e) {
    console.warn('[shareDocument] CSV export failed:', e);
    return fail('Could not create the CSV. Please try again.');
  }
}
