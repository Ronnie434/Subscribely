import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const STORAGE_PREFIX = 'session_manager';
const DEVICE_ID_KEY = `${STORAGE_PREFIX}:device_id_v1`;
const SESSION_METADATA_KEY = `${STORAGE_PREFIX}:metadata_v1`;

const DEFAULT_REFRESH_TTL_DAYS = 14;
const DEFAULT_SESSION_VERSION = 1;

const parseNumber = (value: string | number | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const REFRESH_TTL_MS =
  parseNumber(process.env.EXPO_PUBLIC_REFRESH_TTL_DAYS, DEFAULT_REFRESH_TTL_DAYS) *
  24 *
  60 *
  60 *
  1000;

const CURRENT_SESSION_VERSION = parseNumber(
  process.env.EXPO_PUBLIC_SESSION_VERSION,
  DEFAULT_SESSION_VERSION,
);
const MIN_SESSION_VERSION = parseNumber(
  process.env.EXPO_PUBLIC_MIN_SESSION_VERSION,
  DEFAULT_SESSION_VERSION,
);

export interface SessionMetadata {
  userId: string;
  deviceId: string;
  refreshExpiresAt: number;
  sessionVersion: number;
  lastAccessExpiresAt: number | null;
  updatedAt: number;
}

export enum SessionEnforcementReason {
  RefreshExpired = 'refresh_expired',
  DeviceMismatch = 'device_mismatch',
  SecurityUpgrade = 'security_upgrade',
  SuspiciousActivity = 'suspicious_activity',
}

export interface EnforcementResult {
  reason: SessionEnforcementReason;
  message: string;
}

const getStorageItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`[sessionManager] Failed to read ${key}:`, error);
    return null;
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.warn(`[sessionManager] Failed to store ${key}:`, error);
  }
};

const removeStorageItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.warn(`[sessionManager] Failed to remove ${key}:`, error);
  }
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existingId = await getStorageItem(DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const newId =
    typeof Crypto.randomUUID === 'function'
      ? Crypto.randomUUID()
      : Array.from(Crypto.getRandomBytes(16))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');

  await setStorageItem(DEVICE_ID_KEY, newId);
  return newId;
};

const serializeMetadata = (metadata: SessionMetadata): string => JSON.stringify(metadata);

const deserializeMetadata = (value: string | null): SessionMetadata | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as SessionMetadata;
  } catch (error) {
    console.warn('[sessionManager] Failed to parse metadata, clearing corrupted value');
    return null;
  }
};

export const readSessionMetadata = async (): Promise<SessionMetadata | null> => {
  const value = await getStorageItem(SESSION_METADATA_KEY);
  return deserializeMetadata(value);
};

export const saveSessionMetadata = async (session: Session): Promise<SessionMetadata> => {
  const deviceId = await getOrCreateDeviceId();
  const metadata: SessionMetadata = {
    userId: session.user.id,
    deviceId,
    refreshExpiresAt: Date.now() + REFRESH_TTL_MS,
    sessionVersion: CURRENT_SESSION_VERSION,
    lastAccessExpiresAt: session.expires_at ? session.expires_at * 1000 : null,
    updatedAt: Date.now(),
  };
  await setStorageItem(SESSION_METADATA_KEY, serializeMetadata(metadata));
  return metadata;
};

export const clearSessionMetadata = async (): Promise<void> => {
  await removeStorageItem(SESSION_METADATA_KEY);
};

const formatDefaultMessage = (reason: SessionEnforcementReason): string => {
  switch (reason) {
    case SessionEnforcementReason.RefreshExpired:
      return 'Your session expired. Please sign in again.';
    case SessionEnforcementReason.DeviceMismatch:
      return 'We detected a device change. Please sign in again to continue.';
    case SessionEnforcementReason.SecurityUpgrade:
      return 'We applied a security upgrade. Please sign in again.';
    case SessionEnforcementReason.SuspiciousActivity:
      return 'We could not verify your session. Please sign in again.';
    default:
      return 'Please sign in again.';
  }
};

export const getDefaultReasonMessage = (reason: SessionEnforcementReason): string =>
  formatDefaultMessage(reason);

export const evaluateSession = async (session: Session | null): Promise<EnforcementResult | null> => {
  if (!session) {
    await clearSessionMetadata();
    return null;
  }

  const metadata = await readSessionMetadata();
  const deviceId = await getOrCreateDeviceId();

  if (!metadata) {
    await saveSessionMetadata(session);
    return null;
  }

  if (metadata.userId !== session.user.id) {
    await saveSessionMetadata(session);
    return null;
  }

  if (metadata.deviceId !== deviceId) {
    return {
      reason: SessionEnforcementReason.DeviceMismatch,
      message: formatDefaultMessage(SessionEnforcementReason.DeviceMismatch),
    };
  }

  if (metadata.refreshExpiresAt <= Date.now()) {
    return {
      reason: SessionEnforcementReason.RefreshExpired,
      message: formatDefaultMessage(SessionEnforcementReason.RefreshExpired),
    };
  }

  if (metadata.sessionVersion < MIN_SESSION_VERSION) {
    return {
      reason: SessionEnforcementReason.SecurityUpgrade,
      message: formatDefaultMessage(SessionEnforcementReason.SecurityUpgrade),
    };
  }

  return null;
};

