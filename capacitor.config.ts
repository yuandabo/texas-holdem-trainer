import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.texasholdem.trainer',
  appName: '德州扑克训练器',
  webDir: 'dist',
  android: {
    backgroundColor: '#1a5c2a',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
  },
};

export default config;
