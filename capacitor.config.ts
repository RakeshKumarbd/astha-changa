import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rk.asthachanga.game',
  appName: 'Astha Changa',
  webDir: 'dist',
  backgroundColor: '#4a3527',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#4a3527',
      showSpinner: false,
    },
  },
};

export default config;
