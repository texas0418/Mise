/**
 * utils/useTypography.ts
 *
 * The React Native side of utils/typography.ts: reads the reader's live
 * text-size setting and hands back sizes already scaled.
 *
 * Split from the pure module deliberately. `useWindowDimensions` needs a
 * bundler and a running app, and utils/typography.ts has to stay importable by
 * plain node so scripts/test-typography.ts can execute the arithmetic without
 * one. All the decisions live there; this only supplies the number.
 *
 * `useWindowDimensions().fontScale` is used rather than `PixelRatio.getFontScale()`
 * because it re-renders when the setting changes. `PixelRatio` is read once and
 * a reader who turns text up while the app is backgrounded sees nothing happen
 * until they kill it.
 */
import { useWindowDimensions } from 'react-native';
import {
  scaleFont, scaleOnSetFont, lineHeightFor, TYPE,
  type ScaleOptions, type TypeStep,
} from '@/utils/typography';

export interface Typography {
  /** The system multiplier, 1 at the default setting. */
  fontScale: number;
  /** A scaled size from a raw base. */
  size: (base: number, options?: ScaleOptions) => number;
  /** A scaled size from a named step. */
  step: (name: TypeStep, options?: ScaleOptions) => number;
  /** A scaled size with the on-set floor. */
  onSet: (base: number, options?: ScaleOptions) => number;
  /** A line height for an already-scaled size. */
  lineHeight: (size: number, ratio?: number) => number;
  /** True once the reader is into the accessibility sizes. */
  isLargeText: boolean;
}

export function useTypography(): Typography {
  const { fontScale } = useWindowDimensions();

  return {
    fontScale,
    size: (base, options) => scaleFont(base, fontScale, options),
    step: (name, options) => scaleFont(TYPE[name], fontScale, options),
    onSet: (base, options) => scaleOnSetFont(base, fontScale, options),
    lineHeight: lineHeightFor,
    // Past ~1.3x, rows that were comfortable start needing to wrap or stack.
    // Screens use this to switch layout rather than to shrink text.
    isLargeText: fontScale >= 1.3,
  };
}
