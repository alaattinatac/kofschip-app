import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

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

const listeners = new Map<string, Set<(e: any) => void>>();
const windowMock = {
  dispatchEvent: (event: { type: string; detail?: any }) => {
    const handlers = listeners.get(event.type);
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
    return true;
  },
  addEventListener: (type: string, handler: (e: any) => void) => {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type)!.add(handler);
  },
  removeEventListener: (type: string, handler: (e: any) => void) => {
    const handlers = listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  },
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  }
  if (typeof globalThis.window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: windowMock,
      writable: true,
    });
  }
  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }
});

import {
  isLocalPremium,
  purchaseLifetimePro,
  restorePurchases,
  getPremiumStatus,
  onPremiumStatusChange,
  STORAGE_KEY_PREMIUM,
  REVENUECAT_PRODUCT_ID,
  PREMIUM_PRICE,
  PREMIUM_CURRENCY,
} from './purchases';

describe('RevenueCat & IAP Purchase Handler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports correct product configuration and pricing constants', () => {
    expect(REVENUECAT_PRODUCT_ID).toBe('kofschip_1499_lifetime');
    expect(PREMIUM_PRICE).toBe(14.99);
    expect(PREMIUM_CURRENCY).toBe('EUR');
  });

  it('initially reports non-premium status for fresh user', () => {
    expect(isLocalPremium()).toBe(false);
  });

  it('executes purchaseLifetimePro successfully and persists Pro state', async () => {
    const listener = vi.fn();
    const unsubscribe = onPremiumStatusChange(listener);

    const result = await purchaseLifetimePro();

    expect(result.success).toBe(true);
    expect(result.isPremium).toBe(true);
    expect(result.productIdentifier).toBe(REVENUECAT_PRODUCT_ID);
    expect(localStorage.getItem(STORAGE_KEY_PREMIUM)).toBe('true');
    expect(isLocalPremium()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it('restores purchases successfully when local Pro license exists', async () => {
    localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');

    const result = await restorePurchases();
    expect(result.success).toBe(true);
    expect(result.isPremium).toBe(true);
    expect(result.restored).toBe(true);
  });

  it('returns false for restore when no active license exists', async () => {
    const result = await restorePurchases();
    expect(result.success).toBe(false);
    expect(result.isPremium).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('getPremiumStatus checks both local cache and resolves premium', async () => {
    expect(await getPremiumStatus()).toBe(false);

    localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
    expect(await getPremiumStatus()).toBe(true);
  });
});
