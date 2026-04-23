import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const isMobile = width < 600;

  return {
    width,
    height,
    isDesktop,
    isTablet,
    isMobile,
    contentPadding: isMobile ? 16 : isTablet ? 24 : 32,
    cardGap: isMobile ? 12 : 16,
    itemHeight: isMobile ? Math.round(height / 3.2) : 100,
  };
}
