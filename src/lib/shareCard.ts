import { bestSet, formatDate, formatDuration, formatSet, formatVolume, doneSets, sessionVolume, sessionDuration } from './stats';
import type { SessionPR } from './records';
import type { Session } from './types';

const W = 1080;
const H = 1350;
const FONT = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 글자가 넘치면 크기를 줄여서 맞춘다 */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number, min = 36) {
  let px = size;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > min && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${FONT}`;
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** 인스타그램 피드 비율(4:5) #오운완 카드 */
export interface WeekInfo {
  days: { done: boolean; today: boolean }[];
  label: string;
}

export async function renderShareCard(session: Session, ordinal: number, prs: SessionPR[], week: WeekInfo): Promise<Blob | null> {
  try {
    await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`)]);
  } catch {
    // 시스템 폰트로 그린다
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0b0c');
  bg.addColorStop(1, '#14203d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 520);
  glow.addColorStop(0, 'rgba(59,116,255,0.45)');
  glow.addColorStop(1, 'rgba(59,116,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 88;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#7fa6ff';
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText('#오운완', pad, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`${formatDate(session.startedAt)} · ${ordinal}번째 운동`, pad, 210);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(fitText(ctx, session.routineName, W - pad * 2), pad, 320);

  const stats: [string, string][] = [
    ['시간', formatDuration(sessionDuration(session))],
    ['볼륨', formatVolume(sessionVolume(session))],
    ['세트', `${doneSets(session)}`],
  ];
  const colW = (W - pad * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = pad + i * colW;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(label, x, 420);
    ctx.fillStyle = '#ffffff';
    fitFont(ctx, value, colW - 24, 800, 64);
    ctx.fillText(value, x, 495);
  });

  const listTop = 570;
  const rows = session.exercises.slice(0, 7);
  const more = session.exercises.length > rows.length ? 1 : 0;
  const panelH = Math.max(3, rows.length + more) * 76 + 56;
  roundRect(ctx, pad - 24, listTop, W - (pad - 24) * 2, panelH, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();

  const prNames = new Set(prs.map((p) => p.exercise));
  rows.forEach((e, i) => {
    const y = listTop + 78 + i * 76;
    const best = bestSet(e);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(fitText(ctx, e.name, 520), pad + 8, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = prNames.has(e.name) ? '#ffc93c' : 'rgba(255,255,255,0.7)';
    ctx.font = `600 36px ${FONT}`;
    const right = best ? `${prNames.has(e.name) ? '🏆 ' : ''}${e.sets.filter((s) => s.done && s.type !== 'warmup').length}세트 · ${formatSet(e.kind, best)}` : '';
    ctx.fillText(right, W - pad - 8, y);
    ctx.textAlign = 'left';
  });
  if (session.exercises.length > rows.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `500 32px ${FONT}`;
    ctx.fillText(`외 ${session.exercises.length - rows.length}종목`, pad + 8, listTop + 78 + rows.length * 76);
  }

  // 이번 주 운동한 날
  const weekTop = H - 300;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText('이번 주', pad, weekTop);
  ctx.textAlign = 'right';
  ctx.fillText(week.label, W - pad, weekTop);
  ctx.textAlign = 'center';
  const names = ['월', '화', '수', '목', '금', '토', '일'];
  const step = (W - pad * 2) / 7;
  week.days.forEach((d, i) => {
    const cx = pad + step * i + step / 2;
    const cy = weekTop + 80;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = d.done ? '#3b74ff' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    if (d.today) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
    }
    ctx.fillStyle = d.done ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(names[i], cx, cy + 10);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('헬린이', pad, H - 80);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `500 30px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(prs.length > 0 ? `새 기록 ${prs.length}개 🔥` : '오늘도 득근', W - pad, H - 80);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** 공유 시트가 있으면 공유, 없으면 이미지 저장 */
export async function shareImage(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '#오운완' });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
