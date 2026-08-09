/**
 * utils/useTypography.ts
 *
 * The live text-size setting, for the things the platform will not scale.
 *
 * `<Text>` scales itself — `allowFontScaling` defaults to true — so nothing
 * here returns a font size. What it returns is the reader's scale, the two
 * derived values that need it, and a flag for switching layout.
 *
 * `useWindowDimensions().fontScale` rather than `PixelRatio.getFontScale()`
 * because it re-renders when the setting changes. `PixelRatio` is read once,
 * and a reader who turns text up while the app is backgrounded sees nothing
 * happen until they kill it.
 */
import { useWindowDimensions } from 'react-native';
import {
  scaleNonText, LARGE_TEXT_THRESHOLD, MAX_TEXT_SCALE,
} from '@/utils/typography';

export interface Typography {
  /** The system multiplier, 1 at the default setting. */
  fontScale: number;
  /**
   * An icon glyph size for the current setting. Icons sit beside text and look
   * broken when the text grows past them, but they do not scale on their own.
   */
  icon: (base: number) => number;
  /** A hit target, gap or other non-text dimension for the current setting. */
  space: (base: number) => number;
  /** True once the reader is into the accessibility sizes — switch layout, do not shrink text. */
  isLargeText: boolean;
  /**
   * Hand to `<Text maxFontSizeMultiplier>` on dense surfaces where a row stops
   * being a row. Deliberately not applied globally: most text should just grow.
   */
  denseTextCap: number;
}

export function useTypography(): Typography {
  const { fontScale } = useWindowDimensions();

  return {
    fontScale,
    icon: base => scaleNonText(base, fontScale),
    space: base => scaleNonText(base, fontScale),
    isLargeText: fontScale >= LARGE_TEXT_THRESHOLD,
    denseTextCap: MAX_TEXT_SCALE,
  };
}
