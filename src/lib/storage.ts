import { seedRoutines } from './seed';
import type { AppState, Settings } from './types';

const KEY = 'hellini:v1';

const defaultSettings: Settings = { sound: true, vibrate: true };

export function defaultState(): AppState {
  return { version: 1, routines: seedRoutines(), history: [], active: null, settings: { ...defaultSettings } };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** 저장된 JSON이나 가져온 백업 파일을 검사한다. 모양이 다르면 null */
export function parseState(x: unknown): AppState | null {
  if (!isObject(x) || x.version !== 1) return null;
  if (!Array.isArray(x.routines) || !Array.isArray(x.history)) return null;
  return {
    version: 1,
    routines: x.routines as AppState['routines'],
    history: x.history as AppState['history'],
    active: isObject(x.active) ? (x.active as unknown as AppState['active']) : null,
    settings: { ...defaultSettings, ...(isObject(x.settings) ? (x.settings as Partial<Settings>) : {}) },
  };
}

export function loadState(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return defaultState();
  }
  if (raw === null) return defaultState();
  try {
    const parsed = parseState(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    // 아래에서 원본을 보존한다
  }
  try {
    localStorage.setItem(`${KEY}:corrupt-${Date.now()}`, raw);
  } catch {
    // 보존도 못 하면 어쩔 수 없다
  }
  return defaultState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 막힌 환경(사생활 보호 모드 등)에서는 메모리에서만 동작
  }
}

/** 브라우저가 저장소를 임의로 비우지 않도록 요청 (지원하는 브라우저만) */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // 무시
  }
}

export function exportFileName(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `hellini-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
