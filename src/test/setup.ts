import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clear } from 'idb-keyval';

/**
 * Each test starts from a clean browser: no leftover progress in localStorage and
 * no imported packs in IndexedDB. Otherwise tests would leak state into each
 * other through the very storage the app relies on.
 */
beforeEach(async () => {
  localStorage.clear();
  // A fresh factory, otherwise a pack imported by one test is still installed in
  // the next one and the app under test is not actually starting clean.
  globalThis.indexedDB = new IDBFactory();
  await clear().catch(() => {});
});

afterEach(() => {
  cleanup();
});
