// ---------------------------------------------------------------------------
// utils/scriptPicker.ts — Pick a PDF, upload to Supabase Storage, get signed URL
// ---------------------------------------------------------------------------

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

const SCRIPTS_BUCKET = 'scripts';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

export interface PickedPDF {
  uri: string;        // local URI on device (file:///...)
  name: string;       // original filename
  size: number;       // bytes
  mimeType: string;
}

// ---------------------------------------------------------------------------
// pickPDF — open the document picker, return picked file info
// ---------------------------------------------------------------------------
export async function pickPDF(): Promise<PickedPDF | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,  // iOS needs this to access the file
      multiple: false,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset) return null;

    // Validate size
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      Alert.alert(
        'File Too Large',
        `This PDF is ${(asset.size / 1024 / 1024).toFixed(1)}MB. The maximum size is 50MB.`
      );
      return null;
    }

    return {
      uri: asset.uri,
      name: asset.name || 'script.pdf',
      size: asset.size || 0,
      mimeType: asset.mimeType || 'application/pdf',
    };
  } catch (e) {
    console.log('PDF picker error:', e);
    Alert.alert('Error', 'Could not open the file picker.');
    return null;
  }
}

// ---------------------------------------------------------------------------
// uploadPDFToSupabase — upload picked PDF to the 'scripts' bucket
// Returns the storage path on success (used in the script_pdfs.file_path column)
// ---------------------------------------------------------------------------
export async function uploadPDFToSupabase(
  pdf: PickedPDF,
  projectId: string,
  userId: string,
): Promise<string | null> {
  try {
    // Build storage path: {projectId}/{userId}-{timestamp}-{filename}
    const timestamp = Date.now();
    const safeName = pdf.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${projectId}/${userId}-${timestamp}-${safeName}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(pdf.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer for Supabase upload
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage
      .from(SCRIPTS_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.log('Supabase upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload the PDF.');
      return null;
    }

    return filePath;
  } catch (e: any) {
    console.log('Upload error:', e);
    Alert.alert('Upload Failed', e.message || 'Could not upload the PDF.');
    return null;
  }
}

// ---------------------------------------------------------------------------
// getSignedScriptURL — get a temporary signed URL to view the PDF
// Call this when opening the viewer; URLs expire after 1 hour
// ---------------------------------------------------------------------------
export async function getSignedScriptURL(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(SCRIPTS_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.log('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (e) {
    console.log('Signed URL error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// deleteScriptFromStorage — remove PDF from the 'scripts' bucket
// Call when the ScriptPDF record is soft-deleted
// ---------------------------------------------------------------------------
export async function deleteScriptFromStorage(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(SCRIPTS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.log('Delete error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.log('Delete error:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Base64 → Uint8Array decoder (no external library needed)
// ---------------------------------------------------------------------------
function decode(base64: string): Uint8Array {
  const binary = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
