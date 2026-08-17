/**
 * components/PdfSurface.tsx
 *
 * The page-turning PDF surface, on a device.
 *
 * Split out of app/script-viewer.tsx so the web build can resolve a different
 * file (PdfSurface.web.tsx) rather than a stubbed native module. Before this,
 * `react-native-pdf` was imported directly by the screen, so the desktop build
 * resolved it to an empty object and rendering the script viewer threw (#111).
 *
 * The import stays inside this file deliberately: nothing above it should have
 * to know which platform it is on.
 */
import React from 'react';
import Pdf from 'react-native-pdf';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PdfSurfaceProps {
  uri: string;
  /** Native pdf handle — `setPage` is called on it by the page controls. */
  pdfRef: React.MutableRefObject<any>;
  style?: StyleProp<ViewStyle>;
  onLoadComplete: (numberOfPages: number) => void;
  onPageChanged: (page: number) => void;
  onError: (err: unknown) => void;
}

/** True where the surface can report pages and be driven to one. */
export const PDF_SURFACE_IS_PAGED = true;

export default function PdfSurface({
  uri, pdfRef, style, onLoadComplete, onPageChanged, onError,
}: PdfSurfaceProps) {
  return (
    <Pdf
      ref={pdfRef}
      source={{ uri, cache: true }}
      style={style}
      enablePaging
      horizontal={false}
      enableAntialiasing
      enableAnnotationRendering={false}
      fitPolicy={0}
      spacing={0}
      onLoadComplete={onLoadComplete}
      onPageChanged={onPageChanged}
      onError={onError}
    />
  );
}
