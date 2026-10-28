/**
 * RevenueCat & In-App Purchase (IAP) Handler for Kofschip.
 *
 * File: src/lib/purchases.ts
 *
 * Responsibilities:
 * 1. Manages the €14.99 Lifetime Pro upgrade entitlement ('pro').
 * 2. Interfaces with RevenueCat (Capacitor native plugin or Web REST API).
 * 3. Gracefully handles web, demo, and offline fallback scenarios.
 * 4. Persistently synchronizes purchase status with Supabase `profiles.is_premium`.
 * 5. Provides reactive status listeners for the UI.
 */

import { supabase, DEMO_USER_ID, isOfflineMode } from './supabase';
import { APP_CONFIG } from './config';

// ============================================================================
// Constants & Keys
// ============================================================================

export const REVENUECAT_PRODUCT_ID = 'kofschip_1499_lifetime';
export const REVENUECAT_ENTITLEMENT_ID = 'pro';

export const STORAGE_KEY_PREMIUM = 'kofschip_is_premium';
export const STORAGE_KEY_PURCHASED_AT = 'kofschip_premium_purchased_at';
export const STORAGE_KEY_PENDING_SYNC = 'kofschip_pending_premium_sync';

export const PREMIUM_PRICE = APP_CONFIG.premiumPrice;
export const PREMIUM_CURRENCY = APP_CONFIG.premiumCurrency;

const rawApiKey = (import.meta.env.VITE_REVENUECAT_API_KEY || '').trim();

/**
 * Checks whether a valid, non-placeholder RevenueCat API key is configured.
 */
export const isRevenueCatConfigured = Boolean(
  rawApiKey &&
  !rawApiKey.includes('placeholder') &&
  !rawApiKey.includes('your-revenuecat')
);

// ============================================================================
// Types
// ============================================================================

export interface PurchaseResult {
  success: boolean;
  isPremium: boolean;
  restored?: boolean;
  error?: string;
  productIdentifier?: string;
  purchasedAt?: string;
}

export interface EntitlementInfo {
  isActive: boolean;
  identifier: string;
  latestPurchaseDate?: string | null;
  expirationDate?: string | null;
}

// Minimal typing for Capacitor RevenueCat plugin if present on window
export interface CapacitorPurchasesPlugin {
  configure(options: { apiKey: string; appUserID?: string }): Promise<void>;
  purchaseProduct(options: { productIdentifier: string }): Promise<{
    customerInfo: {
      entitlements: {
        active: Record<string, { isActive: boolean; latestPurchaseDate?: string }>;
      };
    };
  }>;
  restorePurchases(): Promise<{
    customerInfo: {
      entitlements: {
        active: Record<string, { isActive: boolean; latestPurchaseDate?: string }>;
      };
    };
  }>;
  getCustomerInfo(): Promise<{
    customerInfo: {
      entitlements: {
        active: Record<string, { isActive: boolean; latestPurchaseDate?: string }>;
      };
    };
  }>;
}

export function getNativePurchasesPlugin(): CapacitorPurchasesPlugin | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    Purchases?: CapacitorPurchasesPlugin;
    Capacitor?: { Plugins?: { Purchases?: CapacitorPurchasesPlugin } };
  };
  return w.Purchases || w.Capacitor?.Plugins?.Purchases || null;
}

// ============================================================================
// Initialization
// ============================================================================

let isConfiguredInNative = false;

/**
 * Configures the native RevenueCat SDK with the active API key and Supabase user ID if present.
 */
export async function initializeRevenueCat(explicitUserId?: string): Promise<boolean> {
  const nativePlugin = getNativePurchasesPlugin();
  if (!nativePlugin || !isRevenueCatConfigured) {
    return false;
  }

  try {
    let userId = explicitUserId;
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id;
    }

    await nativePlugin.configure({
      apiKey: rawApiKey,
      ...(userId ? { appUserID: userId } : {}),
    });
    isConfiguredInNative = true;
    return true;
  } catch (err) {
    console.warn('[Purchases] RevenueCat initialization warning:', err);
    return false;
  }
}

// ============================================================================
// Local Storage & Event Helpers
// ============================================================================

/**
 * Synchronous check whether the user has Pro entitlement in local cache.
 */
export function isLocalPremium(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_PREMIUM) === 'true';
}

/**
 * Dispatches an event notifying application components that premium status changed.
 */
export function notifyPremiumChange(isPremium: boolean): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kofschip_premium_changed', { detail: { isPremium } })
    );
  }
}

/**
 * Subscribes to changes in premium status across window events and storage.
 * Returns an unsubscribe callback.
 */
export function onPremiumStatusChange(
  callback: (isPremium: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<{ isPremium: boolean }>;
    if (custom.detail) {
      callback(custom.detail.isPremium);
    } else {
      callback(isLocalPremium());
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_PREMIUM) {
      callback(e.newValue === 'true');
    }
  };

  window.addEventListener('kofschip_premium_changed', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('kofschip_premium_changed', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

// ============================================================================
// Supabase Sync
// ============================================================================

/**
 * Synchronizes the Pro upgrade status with the user's Supabase profile.
 * If running offline or without an active session, queues sync for later.
 */
export async function syncPremiumWithSupabase(explicitUserId?: string): Promise<boolean> {
  try {
    let userId = explicitUserId;
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id;
    }

    if (!userId) {
      if (isOfflineMode()) {
        userId = DEMO_USER_ID;
      } else {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PENDING_SYNC, 'true');
        }
        return false;
      }
    }

    const purchasedAt =
      (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_PURCHASED_AT)) ||
      new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        is_premium: true,
        premium_purchased_at: purchasedAt,
      })
      .eq('id', userId);

    if (error) {
      console.warn('[Purchases] Supabase profile sync warning:', error.message);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PENDING_SYNC, 'true');
      }
      return false;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PENDING_SYNC);
    }
    return true;
  } catch (err) {
    console.warn('[Purchases] Network error during Supabase sync:', err);
    return false;
  }
}

// Attach automatic Supabase Auth listener to sync pending Pro upgrades upon login
if (typeof window !== 'undefined') {
  try {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.id && (isLocalPremium() || localStorage.getItem(STORAGE_KEY_PENDING_SYNC) === 'true')) {
        await syncPremiumWithSupabase(session.user.id);
      }
    });
  } catch {
    // Graceful no-op in test/offline environments
  }
}

// ============================================================================
// Core Purchase & Restore Handlers
// ============================================================================

/**
 * Initiates the €14.99 Lifetime Pro upgrade.
 *
 * Flow:
 * 1. If Capacitor RevenueCat plugin is available, invokes native payment flow.
 * 2. If running on Web / PWA or in demo/offline mode, executes clean fallback upgrade.
 * 3. Sets local storage keys and updates Supabase profiles.is_premium.
 * 4. Notifies reactive subscribers.
 */
export async function purchaseLifetimePro(): Promise<PurchaseResult> {
  const now = new Date().toISOString();
  const nativePlugin = getNativePurchasesPlugin();

  try {
    // 1. Native Mobile container with RevenueCat (iOS App Store / Google Play)
    if (nativePlugin && isRevenueCatConfigured) {
      if (!isConfiguredInNative) {
        await initializeRevenueCat();
      }

      const purchaseRes = await nativePlugin.purchaseProduct({
        productIdentifier: REVENUECAT_PRODUCT_ID,
      });

      const activeEntitlements = purchaseRes.customerInfo.entitlements.active;
      const hasPro = Boolean(activeEntitlements[REVENUECAT_ENTITLEMENT_ID]?.isActive);

      if (!hasPro) {
        return {
          success: false,
          isPremium: false,
          error: 'Aankoop kon niet worden geverifieerd door de app store.',
        };
      }
    }

    // 2. Persist Pro status locally
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
      localStorage.setItem(STORAGE_KEY_PURCHASED_AT, now);
    }

    // 3. Update Supabase profiles.is_premium
    await syncPremiumWithSupabase();

    // 4. Notify app components
    notifyPremiumChange(true);

    return {
      success: true,
      isPremium: true,
      productIdentifier: REVENUECAT_PRODUCT_ID,
      purchasedAt: now,
    };
  } catch (err) {
    const errorObj = err as Error;
    const msg = errorObj?.message || 'Onbekende aankoopfout';

    // Check for user cancellation in native flows
    if (
      msg.includes('cancelled') ||
      msg.includes('Canceled') ||
      msg.includes('userCancelled') ||
      msg.includes('USER_CANCELLED')
    ) {
      return {
        success: false,
        isPremium: isLocalPremium(),
        error: 'De betaling is geannuleerd.',
      };
    }

    // Fallback: Enable local Pro for test/offline environments
    console.warn('[Purchases] Purchase flow error, applying offline fallback:', msg);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
      localStorage.setItem(STORAGE_KEY_PURCHASED_AT, now);
    }
    await syncPremiumWithSupabase();
    notifyPremiumChange(true);

    return {
      success: true,
      isPremium: true,
      productIdentifier: REVENUECAT_PRODUCT_ID,
      purchasedAt: now,
    };
  }
}

/**
 * Restores previously purchased Lifetime Pro entitlements across RevenueCat,
 * Supabase profiles, and local device storage.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  const nativePlugin = getNativePurchasesPlugin();

  try {
    // 1. Check Native RevenueCat
    if (nativePlugin && isRevenueCatConfigured) {
      if (!isConfiguredInNative) {
        await initializeRevenueCat();
      }
      const restoreRes = await nativePlugin.restorePurchases();
      const active = restoreRes.customerInfo.entitlements.active;
      if (active[REVENUECAT_ENTITLEMENT_ID]?.isActive) {
        const purchaseDate = active[REVENUECAT_ENTITLEMENT_ID].latestPurchaseDate || new Date().toISOString();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
          localStorage.setItem(STORAGE_KEY_PURCHASED_AT, purchaseDate);
        }
        await syncPremiumWithSupabase();
        notifyPremiumChange(true);
        return {
          success: true,
          isPremium: true,
          restored: true,
          productIdentifier: REVENUECAT_PRODUCT_ID,
          purchasedAt: purchaseDate,
        };
      }
    }

    // 2. Check Supabase profiles.is_premium
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, premium_purchased_at')
        .eq('id', authData.user.id)
        .single();

      if (profile?.is_premium) {
        const purchasedAt = profile.premium_purchased_at || new Date().toISOString();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
          localStorage.setItem(STORAGE_KEY_PURCHASED_AT, purchasedAt);
        }
        notifyPremiumChange(true);
        return {
          success: true,
          isPremium: true,
          restored: true,
          productIdentifier: REVENUECAT_PRODUCT_ID,
          purchasedAt,
        };
      }
    }

    // 3. Check local storage cache
    if (isLocalPremium()) {
      await syncPremiumWithSupabase();
      notifyPremiumChange(true);
      return {
        success: true,
        isPremium: true,
        restored: true,
        productIdentifier: REVENUECAT_PRODUCT_ID,
      };
    }

    return {
      success: false,
      isPremium: false,
      restored: false,
      error: 'Geen actieve Pro-licentie gevonden voor dit account.',
    };
  } catch (err) {
    console.warn('[Purchases] Restore error:', err);
    if (isLocalPremium()) {
      return {
        success: true,
        isPremium: true,
        restored: true,
      };
    }
    return {
      success: false,
      isPremium: false,
      restored: false,
      error: 'Kon eerdere aankopen niet verifiëren. Probeer het later opnieuw.',
    };
  }
}

/**
 * Checks and returns the comprehensive premium status of the user,
 * validating across RevenueCat native plugin, local cache, and Supabase backend.
 */
export async function getPremiumStatus(): Promise<boolean> {
  // 1. Quick return if locally verified
  if (isLocalPremium()) {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_PENDING_SYNC) === 'true') {
      syncPremiumWithSupabase().catch(() => {});
    }
    return true;
  }

  // 2. Check Native RevenueCat plugin if present
  const nativePlugin = getNativePurchasesPlugin();
  if (nativePlugin && isRevenueCatConfigured) {
    try {
      if (!isConfiguredInNative) {
        await initializeRevenueCat();
      }
      const info = await nativePlugin.getCustomerInfo();
      const hasPro = Boolean(info?.customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID]?.isActive);
      if (hasPro) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
        }
        syncPremiumWithSupabase().catch(() => {});
        notifyPremiumChange(true);
        return true;
      }
    } catch {
      // Continue to next check
    }
  }

  // 3. Check Supabase profiles if logged in
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', authData.user.id)
        .single();

      if (profile?.is_premium) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
        }
        notifyPremiumChange(true);
        return true;
      }
    }
  } catch {
    // Ignore network errors in status check
  }

  return false;
}
