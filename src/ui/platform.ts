// What differs between the web app and the iOS/Android apps (Capacitor).

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Public web address that share links point to. Set VITE_PUBLIC_URL when the web
 * version is hosted; until then the apps share a code to paste into Import.
 */
const PUBLIC_URL: string | undefined = import.meta.env.VITE_PUBLIC_URL;

/** A link that opens the game with these rules, or null when there is nowhere to link to. */
export function rulesLink(code: string): string | null {
  if (PUBLIC_URL) return `${PUBLIC_URL.replace(/\/$/, '')}/#rules=${code}`;
  if (isNative()) return null; // capacitor://localhost links mean nothing to anyone else
  return `${location.origin}${location.pathname}#rules=${code}`;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Share text (and a link if any) with the system share sheet, falling back to the clipboard. */
export async function shareText(title: string, text: string, url: string | null): Promise<ShareResult> {
  try {
    if (isNative()) {
      await Share.share({ title, text, url: url ?? undefined, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text, url: url ?? undefined });
      return 'shared';
    }
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return 'copied';
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if ((e as Error)?.name === 'AbortError' || /cancel/i.test(msg)) return 'cancelled';
    return 'failed';
  }
}

/** A short buzz on phones; nothing on the web. */
export function buzz(strong = false): void {
  if (isNative()) void Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
}

/** Native-only setup: status bar colours and the Android back button. */
export function initNative(onBack: () => void): void {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (Capacitor.getPlatform() === 'android') void StatusBar.setBackgroundColor({ color: '#4a3527' }).catch(() => {});
  void App.addListener('backButton', onBack);
}

export const exitApp = (): void => void App.exitApp();

/** Take the launch screen away once the first screen is drawn. */
export function hideSplash(): void {
  if (isNative()) requestAnimationFrame(() => void SplashScreen.hide().catch(() => {}));
}
