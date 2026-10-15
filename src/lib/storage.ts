import { MAIN_PLACE_ID, mainPlace } from './places';
import type { AppState, Place, Settings } from './types';

const KEY = 'hellini:v4';
/** 이전 버전 저장소. 읽기만 하고 지우지 않는다 (되돌릴 수 있게) */
const LEGACY_KEYS = ['hellini:v3', 'hellini:v2'];

export const defaultSettings: Settings = {
  sound: true,
  vibrate: true,
  defaultRestSec: 90,
  barKg: 20,
  weeklyGoal: 3,
  placeId: MAIN_PLACE_ID,
};

export function defaultState(): AppState {
  return {
    version: 4,
    onboarded: false,
    routines: [],
    history: [],
    active: null,
    customExercises: [],
    places: [mainPlace()],
    body: [],
    profile: {},
    settings: { ...defaultSettings },
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** 저장된 JSON이나 가져온 백업 파일을 검사한다. 옛 버전(v2·v3)은 빠진 칸을 채워 올린다. 모양이 다르면 null */
export function parseState(x: unknown): AppState | null {
  if (!isObject(x) || (x.version !== 2 && x.version !== 3 && x.version !== 4)) return null;
  if (!Array.isArray(x.routines) || !Array.isArray(x.history)) return null;
  const places = (Array.isArray(x.places) ? (x.places as Place[]) : []).filter((p) => isObject(p) && typeof p.id === 'string');
  if (!places.some((p) => p.id === MAIN_PLACE_ID)) places.unshift(mainPlace());
  const settings: Settings = { ...defaultSettings, ...(isObject(x.settings) ? (x.settings as Partial<Settings>) : {}) };
  if (!places.some((p) => p.id === settings.placeId)) settings.placeId = MAIN_PLACE_ID;
  const body = (Array.isArray(x.body) ? (x.body as AppState['body']) : []).filter((b) => isObject(b) && typeof b.weightKg === 'number');
  return {
    version: 4,
    onboarded: x.onboarded === true,
    routines: x.routines as AppState['routines'],
    history: x.history as AppState['history'],
    active: isObject(x.active) ? (x.active as unknown as AppState['active']) : null,
    customExercises: Array.isArray(x.customExercises) ? (x.customExercises as AppState['customExercises']) : [],
    places: places.map((p) => ({ ...p, unavailable: Array.isArray(p.unavailable) ? p.unavailable : [], swaps: isObject(p.swaps) ? p.swaps : {} })),
    body: [...body].sort((a, b) => b.date - a.date),
    profile: isObject(x.profile) ? (x.profile as AppState['profile']) : {},
    settings,
  };
}

export function loadState(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    for (const k of LEGACY_KEYS) if (raw === null) raw = localStorage.getItem(k);
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
