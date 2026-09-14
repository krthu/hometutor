/**
 * Offline support -- built, but deliberately not switched on.
 *
 * A service worker is sticky: once registered on an origin it keeps serving from
 * its cache, and a stale one can hand her an old build long after a fix shipped.
 * Since the app currently runs on a dev server on the home network, that risk
 * buys nothing -- offline only matters once there is a real URL she carries around.
 *
 * To turn it on, set VITE_ENABLE_PWA=true at build time. Note that browsers only
 * register service workers over HTTPS (or on localhost), so this needs a real
 * host, not a LAN IP.
 */
export async function registerServiceWorker(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_PWA !== 'true') return;
  if (!('serviceWorker' in navigator)) return;

  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}

/**
 * Unregister any service worker left over from an earlier experiment.
 *
 * Without this, a browser that once registered one would keep serving the cached
 * build even after the feature was turned off again.
 */
export async function unregisterStaleServiceWorkers(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_PWA === 'true') return;
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  for (const registration of registrations) await registration.unregister();
}
