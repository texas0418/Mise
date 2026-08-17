/**
 * components/PdfSurface.web.tsx
 *
 * The same surface in a browser, which already has a PDF viewer.
 *
 * `react-native-pdf` has no web build, so the desktop bundle stubs it. Rather
 * than ship a stub that renders nothing, the browser gets what it is good at:
 * an <iframe> onto the file, with the platform's own scrolling, zoom, search
 * and print. On a desk that is better than a reimplementation of it.
 *
 * What it deliberately does NOT do is pretend to be paged. The native surface
 * reports a page count and can be driven to a page; an iframe can do neither
 * without embedding a full PDF engine. `PDF_SURFACE_IS_PAGED` is false here so
 * the screen can hide the page controls and the annotation tools rather than
 * show controls that quietly do nothing — annotations are anchored to a page
 * and a scroll offset this surface cannot report.
 *
 * `onLoadComplete` is still called, with 0 pages, so the screen's loading
 * state clears. A caller that treats 0 as "unknown" behaves correctly; one
 * that treats it as "no pages" would be reading it as a failure, which is why
 * the flag above exists rather than leaning on the number.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { PdfSurfaceProps } from './PdfSurface';

/** A browser PDF view scrolls; it does not turn pages we can count. */
export const PDF_SURFACE_IS_PAGED = false;

export default function PdfSurface({ uri, style, onLoadComplete, onError }: PdfSurfaceProps) {
  const handled = React.useRef(false);

  return (
    <View style={[{ flex: 1, backgroundColor: '#111' }, style as StyleProp<ViewStyle>]}>
      {/*
        Rendered as a raw iframe rather than any RN primitive: react-native-web
        has no element that maps to one, and the browser's viewer is the whole
        point of taking this path.
      */}
      {React.createElement('iframe', {
        src: uri,
        title: 'Script',
        style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#111' },
        onLoad: () => {
          if (handled.current) return;
          handled.current = true;
          onLoadComplete(0);
        },
        onError: () => {
          if (handled.current) return;
          handled.current = true;
          onError(new Error('The browser could not display this PDF.'));
        },
      })}
    </View>
  );
}
