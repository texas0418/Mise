import { useWindowDimensions, Platform } from 'react-native';

export interface LayoutInfo {
  isTablet: boolean;
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

  const sidebarWidth = isTablet ? 260 : 0;
  const availableWidth = isTablet && isLandscape ? width - sidebarWidth : width;

  // Content width: cap at 800px for readability on large screens
  const contentWidth = isTablet ? Math.min(availableWidth - 40, 800) : width;
  const contentPadding = isTablet ? 24 : 16;

  // Grid columns based on available width
  let gridColumns = 1;
  if (availableWidth >= 1000) gridColumns = 4;
  else if (availableWidth >= 700) gridColumns = 3;
  else if (availableWidth >= 500) gridColumns = 2;

  const cardMinWidth = isTablet ? 280 : 0;
  const fontScale = isTablet ? 1.1 : 1;

  return {
    isTablet,
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
