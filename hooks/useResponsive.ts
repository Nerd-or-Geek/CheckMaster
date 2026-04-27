import { Dimensions, Platform } from 'react-native';
import { useState, useEffect } from 'react';

export function useResponsive() {
  const [dims, setDims] = useState(() => {
    try {
      const d = Dimensions.get('window');
      return { width: d.width || 375, height: d.height || 667 };
    } catch {
      return { width: 375, height: 667 };
    }
  });

  useEffect(() => {
    const update = () => {
      try {
        const d = Dimensions.get('window');
        setDims({ width: d.width || 375, height: d.height || 667 });
      } catch {}
    };
    update();
    const sub = Dimensions.addEventListener('change', update);
    return () => sub?.remove();
  }, []);

  const width = Math.max(1, dims.width);
  const height = Math.max(1, dims.height);
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
