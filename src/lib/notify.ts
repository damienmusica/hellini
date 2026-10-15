/**
 * 휴식 끝 알림 (최선 노력). 화면을 끄거나 다른 앱을 보는 동안 휴식이 끝나면 시스템 알림을 띄운다.
 * - 앱(탭)이 살아 있어야 한다. 완전히 닫으면 오지 않는다 (서버 푸시가 없다).
 * - 아이폰은 홈 화면에 추가한 앱에서만 알림을 쓸 수 있고, 서비스 워커로만 띄울 수 있다.
 * 권한은 설정에서 켜는 순간에만 요청한다.
 */
const TAG = 'hellini-rest';

export type NotifySupport = 'ok' | 'ios-install' | 'unsupported';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  return 'ok';
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

/** 권한 요청. 허용됐으면 true */
export async function requestNotify(): Promise<boolean> {
  if (notifySupport() !== 'ok') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return (await navigator.serviceWorker?.getRegistration()) ?? undefined;
  } catch {
    return undefined;
  }
}

/** 휴식이 끝났을 때. 서비스 워커가 있으면 그걸로(아이폰은 이 길만 됨), 없으면 페이지 알림 */
export async function showRestEnd(body: string): Promise<void> {
  if (notifyPermission() !== 'granted') return;
  const options: NotificationOptions = { body, tag: TAG, icon: `${import.meta.env.BASE_URL}pwa-192.png`, badge: `${import.meta.env.BASE_URL}pwa-192.png` };
  const reg = await registration();
  if (reg) {
    try {
      await reg.showNotification('휴식 끝', options);
      return;
    } catch {
      // 아래 페이지 알림으로
    }
  }
  try {
    new Notification('휴식 끝', options);
  } catch {
    // 지원하지 않는 환경
  }
}

/** 앱으로 돌아오면 남은 휴식 알림을 치운다 */
export async function clearRestNotification(): Promise<void> {
  const reg = await registration();
  if (!reg) return;
  try {
    for (const n of await reg.getNotifications({ tag: TAG })) n.close();
  } catch {
    // 무시
  }
}
