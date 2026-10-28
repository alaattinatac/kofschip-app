import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Validates whether real Supabase environment variables are present and configured.
 */
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  !rawUrl.includes('placeholder') &&
  !rawUrl.includes('your-project') &&
  rawAnonKey !== 'your-supabase-anon-key-here' &&
  rawAnonKey !== 'placeholder-key' &&
  rawAnonKey !== 'placeholder-anon-key'
);

/**
 * Checks if the application is currently running in offline or demo fallback mode.
 */
export function isOfflineMode(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (import.meta.env.VITE_APP_ENV === 'demo') {
    return true;
  }
  return !isSupabaseConfigured;
}

export const DEMO_USER_ID = 'offline-demo-user-nt2';

export const DEMO_PROFILE = {
  id: DEMO_USER_ID,
  display_name: 'NT2 Cursist',
  native_language: 'en',
  current_level: 'A2',
  is_premium: false,
  premium_purchased_at: null as string | null,
  daily_scan_count: 0,
  streak_days: 1,
  total_verbs_practiced: 10,
  total_correct: 9,
};

/**
 * Creates a graceful mock Response for offline and demo mode requests
 * preventing unhandled network rejections and allowing seamless local operation.
 */
export async function handleOfflineFallback(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = input.toString();
  const method = init?.method?.toUpperCase() || 'GET';

  let acceptHeader = '';
  if (init?.headers) {
    if (typeof (init.headers as Headers).get === 'function') {
      acceptHeader = (init.headers as Headers).get('Accept') || '';
    } else {
      const h = init.headers as Record<string, string>;
      acceptHeader = h['Accept'] || h['accept'] || '';
    }
  }

  const isSingle = acceptHeader.includes('vnd.pgrst.object');

  // 1. Supabase Auth endpoints (User & Session)
  if (url.includes('/auth/v1/user') || url.includes('/auth/v1/session')) {
    return new Response(JSON.stringify({ user: null, session: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Supabase REST profiles endpoint
  if (url.includes('/rest/v1/profiles')) {
    const isPremium = typeof localStorage !== 'undefined' && localStorage.getItem('kofschip_is_premium') === 'true';
    const purchasedAt = typeof localStorage !== 'undefined' ? localStorage.getItem('kofschip_premium_purchased_at') : null;

    const profile = {
      ...DEMO_PROFILE,
      is_premium: isPremium,
      premium_purchased_at: isPremium ? (purchasedAt || new Date().toISOString()) : null,
    };

    if (method === 'PATCH' || method === 'POST') {
      try {
        if (init?.body && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (body.is_premium !== undefined && typeof localStorage !== 'undefined') {
            localStorage.setItem('kofschip_is_premium', body.is_premium ? 'true' : 'false');
            if (body.is_premium) {
              const dateStr = body.premium_purchased_at || new Date().toISOString();
              localStorage.setItem('kofschip_premium_purchased_at', dateStr);
              profile.is_premium = true;
              profile.premium_purchased_at = dateStr;
            } else {
              localStorage.removeItem('kofschip_premium_purchased_at');
              profile.is_premium = false;
              profile.premium_purchased_at = null;
            }
          }
        }
      } catch {
        // Safe parse fallback
      }
      return new Response(JSON.stringify(isSingle ? profile : [profile]), {
        status: 200,
        headers: {
          'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
          'Content-Range': '0-0/1',
        },
      });
    }

    const payload = isSingle ? profile : [profile];
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
        'Content-Range': '0-0/1',
      },
    });
  }

  // 3. Supabase REST saved_words endpoint
  if (url.includes('/rest/v1/saved_words')) {
    interface LocalSavedWord {
      id?: string;
      infinitive?: string;
      mastery_score?: number;
      notes?: string;
      next_review_at?: string;
      created_at?: string;
    }

    let localWords: LocalSavedWord[] = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('kofschip_saved_words_cache');
        if (cached) localWords = JSON.parse(cached);
      }
    } catch {
      localWords = [];
    }

    if (method === 'GET') {
      return new Response(JSON.stringify(localWords), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': `0-${Math.max(0, localWords.length - 1)}/${localWords.length}`,
        },
      });
    }

    if (method === 'POST') {
      let createdItem: LocalSavedWord = {
        id: `word-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      try {
        if (init?.body && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          createdItem = {
            ...createdItem,
            ...body,
            id: body.id || `word-${Date.now()}`,
          };
          const next = [createdItem, ...localWords.filter((w) => w.infinitive !== createdItem.infinitive)];
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('kofschip_saved_words_cache', JSON.stringify(next));
          }
        }
      } catch {
        // Safe fallback
      }
      return new Response(JSON.stringify([createdItem]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE') {
      const match = url.match(/id=eq\.([^&]+)/);
      if (match && match[1] && typeof localStorage !== 'undefined') {
        const targetId = decodeURIComponent(match[1]);
        const next = localWords.filter((w) => w.id !== targetId);
        localStorage.setItem('kofschip_saved_words_cache', JSON.stringify(next));
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Supabase REST verb_logs, camera_scans, and daily_challenges
  if (method === 'POST') {
    return new Response(JSON.stringify([{ id: `mock-${Date.now()}`, created_at: new Date().toISOString() }]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Resilient fetch wrapper: routes through real Supabase when online and configured,
 * and seamlessly falls back to local handlers when offline or in demo mode.
 */
const customFetch: typeof fetch = async (input, init) => {
  if (isOfflineMode()) {
    return handleOfflineFallback(input, init);
  }

  try {
    const response = await fetch(input, init);
    return response;
  } catch {
    // Gracefully handle sudden network disconnect or DNS lookup failure
    return handleOfflineFallback(input, init);
  }
};

/**
 * Normalizes Supabase project URL to ensure a valid RFC-compliant HTTP(S) URL.
 */
function resolveSupabaseUrl(url: string): string {
  if (!url) return 'https://placeholder.supabase.co';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

/**
 * Supabase client instance initialized with env variables and graceful offline/demo fallback.
 */
export const supabase: SupabaseClient = createClient(
  resolveSupabaseUrl(rawUrl),
  rawAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: customFetch,
    },
  }
);
