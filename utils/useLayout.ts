import { useWindowDimensions, Platform } from 'react-native';

/** Below this a browser window is a phone in disguise; above it, a desk. */
export const DESKTOP_BREAKPOINT = 1024;
/**
 * Wide enough for a budget table or a call sheet without becoming a line of
 * text too long to track back from. Prose caps lower; tables get this.
 */
export const DESKTOP_CONTENT_MAX = 1280;

export interface LayoutInfo {
  isTablet: boolean;
  /**
   * A desk, not a device held in two hands.
   *
   * Separate from `isTablet` because they want opposite things: a tablet in
   * landscape is still one column of cards read at arm's length, while a
   * browser window at 1200px is a spreadsheet, a directory and a call sheet
   * that should use the width they have. Everything above 1024 logical px on
   * a platform with a pointer is treated as a desk (#111).
   */
  isDesktop: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
  // Content width constrained for readability on large screens
  contentWidth: number;
  contentPadding: number;
  // Grid columns for card layouts
  gridColumns: number;
  // Sidebar width (for tablet navigation)
  sidebarWidth: number;
  // Card sizing
  cardMinWidth: number;
  // Font scale
  fontScale: number;
}

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const sidebarWidth = isTablet ? 260 : 0;
  const availableWidth = isTablet && isLandscape ? width - sidebarWidth : width;

  /*
   * 800px is right for a card list read at arm's length and wrong for a desk:
   * on a 1440px browser it left half the window empty while the budget table
   * scrolled sideways inside it. Desktop gets the width, still capped so a
   * maximised 4K window does not produce lines nobody can track back from.
   */
  const contentWidth = isDesktop
    ? Math.min(availableWidth - 64, DESKTOP_CONTENT_MAX)
    : isTablet ? Math.min(availableWidth - 40, 800) : width;
  const contentPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  // Grid columns based on available width
  let gridColumns = 1;
  if (availableWidth >= 1000) gridColumns = 4;
  else if (availableWidth >= 700) gridColumns = 3;
  else if (availableWidth >= 500) gridColumns = 2;

  const cardMinWidth = isTablet ? 280 : 0;
  const fontScale = isTablet ? 1.1 : 1;

  return {
    isTablet,
    isDesktop,
    isLandscape,
    width,
    height,
    contentWidth,
    contentPadding,
    gridColumns,
    sidebarWidth,
    cardMinWidth,
    fontScale,
  };
}
