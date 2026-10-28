import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Polyfill localStorage & window for Node test environment
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  get length() { return storage.size; },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  }
});

import {
  supabase,
  isOfflineMode,
  isSupabaseConfigured,
  handleOfflineFallback,
  DEMO_USER_ID,
} from './supabase';

describe('Supabase Client & Offline Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes Supabase client instance without runtime errors', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });

  it('correctly reports configuration and offline mode status', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean');
    expect(typeof isOfflineMode()).toBe('boolean');
  });

  it('handles offline fallback for auth endpoints', async () => {
    const res = await handleOfflineFallback('https://example.supabase.co/auth/v1/user');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeNull();
  });

  it('handles offline fallback for profiles GET (default profile)', async () => {
    const res = await handleOfflineFallback('https://example.supabase.co/rest/v1/profiles', {
      headers: { Accept: 'application/vnd.pgrst.object+json' },
    });
    expect(res.status).toBe(200);
    const profile = await res.json();
    expect(profile.id).toBe(DEMO_USER_ID);
    expect(profile.is_premium).toBe(false);
  });

  it('handles offline fallback for profiles PATCH (upgrading to premium)', async () => {
    const patchRes = await handleOfflineFallback('https://example.supabase.co/rest/v1/profiles', {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.pgrst.object+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_premium: true }),
    });

    expect(patchRes.status).toBe(200);
    expect(localStorage.getItem('kofschip_is_premium')).toBe('true');

    // Verify subsequent GET reflects premium status
    const getRes = await handleOfflineFallback('https://example.supabase.co/rest/v1/profiles', {
      headers: { Accept: 'application/vnd.pgrst.object+json' },
    });
    const profile = await getRes.json();
    expect(profile.is_premium).toBe(true);
  });

  it('handles offline fallback for saved_words CRUD', async () => {
    // 1. Initial GET
    const initialGet = await handleOfflineFallback('https://example.supabase.co/rest/v1/saved_words');
    expect(initialGet.status).toBe(200);
    const initialList = await initialGet.json();
    expect(Array.isArray(initialList)).toBe(true);

    // 2. POST new word
    const postRes = await handleOfflineFallback('https://example.supabase.co/rest/v1/saved_words', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-word-1',
        infinitive: 'werken',
        mastery_score: 1,
      }),
    });
    expect(postRes.status).toBe(201);
    const postedItem = await postRes.json();
    expect(postedItem[0].infinitive).toBe('werken');

    // 3. Verify saved in cache
    const cached = JSON.parse(localStorage.getItem('kofschip_saved_words_cache') || '[]');
    expect(cached.some((w: { infinitive: string }) => w.infinitive === 'werken')).toBe(true);

    // 4. DELETE word
    const deleteRes = await handleOfflineFallback(
      'https://example.supabase.co/rest/v1/saved_words?id=eq.test-word-1',
      { method: 'DELETE' }
    );
    expect(deleteRes.status).toBe(200);
    const afterDeleteCached = JSON.parse(localStorage.getItem('kofschip_saved_words_cache') || '[]');
    expect(afterDeleteCached.some((w: { id: string }) => w.id === 'test-word-1')).toBe(false);
  });
});
