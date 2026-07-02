export const theme = {
  color: {
    surface: '#FFFFFF',
    onSurface: '#1A1A1A',
    surfaceSecondary: '#F4F4F5',
    onSurfaceSecondary: '#3F3F46',
    surfaceTertiary: '#E4E4E7',
    onSurfaceTertiary: '#52525B',
    surfaceInverse: '#1A1A1A',
    onSurfaceInverse: '#FFFFFF',
    brand: '#E65100',
    brandPrimary: '#E65100',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#F57C00',
    brandTertiary: '#FFF3E0',
    onBrandTertiary: '#E65100',
    success: '#2E7D32',
    onSuccess: '#FFFFFF',
    warning: '#F57F17',
    onWarning: '#FFFFFF',
    error: '#C62828',
    onError: '#FFFFFF',
    info: '#424242',
    border: '#E4E4E7',
    borderStrong: '#A1A1AA',
    divider: '#F4F4F5',
    // dark KDS
    kdsBg: '#0F0F10',
    kdsCard: '#1C1C1E',
    kdsCardAccent: '#2C2C2E',
    kdsText: '#F4F4F5',
    kdsTextMuted: '#A1A1AA',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, display: 30,
  },
};

export const statusColor = (status: string) => {
  switch (status) {
    case 'pending': return theme.color.warning;
    case 'accepted': return theme.color.info;
    case 'preparing': return theme.color.brandSecondary;
    case 'ready': return theme.color.success;
    case 'completed': return theme.color.onSurfaceSecondary;
    case 'cancelled': return theme.color.error;
    default: return theme.color.onSurfaceSecondary;
  }
};
