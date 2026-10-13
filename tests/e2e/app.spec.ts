import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T19:00:00+09:00') });
  await page.goto('/');
});

test('루틴으로 운동하고 휴식 타이머를 거쳐 기록을 남긴다', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '오늘 운동' })).toBeVisible();
  await page.locator('.routine-card', { hasText: '전신 A (예시)' }).getByRole('button', { name: '시작' }).click();

  const panel = page.locator('.panel').first();
  await expect(panel).toContainText('스쿼트');
  await expect(panel).toContainText('1 / 3 세트');

  // 무게 올리기: 남은 세트에도 같이 적용
  await page.getByRole('button', { name: '무게 늘리기' }).click();
  await expect(page.getByRole('textbox', { name: '무게' })).toHaveValue('22.5');

  await page.getByRole('button', { name: '세트 완료', exact: true }).click();
  const rest = page.getByLabel('휴식 타이머');
  await expect(rest).toContainText('1:30');
  await page.getByRole('button', { name: '+15초' }).click();
  await expect(rest).toContainText('1:45');

  // 휴식이 끝나면 자동으로 다음 세트로
  await page.clock.fastForward('01:46');
  await expect(rest).toBeHidden();
  await expect(panel).toContainText('2 / 3 세트');
  await expect(page.getByRole('textbox', { name: '무게' })).toHaveValue('22.5');

  await page.getByRole('button', { name: '세트 완료', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(panel).toContainText('3 / 3 세트');

  // 다른 탭으로 가도 운동은 계속, 알약 버튼으로 돌아온다
  await page.getByRole('button', { name: '세트 완료', exact: true }).click();
  await page.getByRole('button', { name: '기록' }).click();
  await expect(page.locator('.active-pill')).toContainText('휴식');
  await page.locator('.active-pill').click();
  await expect(panel).toContainText('벤치프레스');

  await page.getByRole('button', { name: '종료' }).click();
  await expect(page.getByRole('dialog')).toContainText('3 / 12');
  await page.getByRole('button', { name: '저장하고 종료' }).click();

  await expect(page.getByRole('heading', { name: '최근 운동' })).toBeVisible();
  await expect(page.getByText('3세트 · 볼륨 675kg')).toBeVisible();

  // 새로고침해도 기록과 오늘 무게가 남아 있다
  await page.reload();
  await expect(page.getByText('3세트 · 볼륨 675kg')).toBeVisible();
  await page.getByRole('button', { name: '루틴' }).click();
  await expect(page.getByText('스쿼트 — 3세트 · 22.5kg × 10')).toBeVisible();
});

test('시간 세트(플랭크)는 타이머가 끝나면 자동 완료된다', async ({ page }) => {
  await page.locator('.routine-card', { hasText: '맨몸 서킷 (예시)' }).getByRole('button', { name: '시작' }).click();
  await page.locator('.exercise-row-head', { hasText: '플랭크' }).click();
  await page.getByRole('button', { name: '40초 시작' }).click();
  const work = page.getByLabel('운동 타이머');
  await expect(work).toContainText('0:40');
  await page.clock.fastForward('00:41');
  await expect(work).toBeHidden();
  await expect(page.getByLabel('휴식 타이머')).toBeVisible();
  await expect(page.getByRole('button', { name: '플랭크 1세트 완료됨' })).toBeVisible();
});

test('인터벌 타이머가 준비 → 운동 → 휴식으로 넘어간다', async ({ page }) => {
  await page.getByRole('button', { name: '타이머' }).click();
  await page.getByRole('button', { name: '타바타 20/10 ×8' }).click();
  await page.getByRole('button', { name: '▶ 시작' }).first().click();
  const timer = page.getByLabel('인터벌 타이머');
  await expect(timer).toContainText('준비');
  await page.clock.fastForward('00:11');
  await expect(timer).toContainText('운동');
  await expect(timer).toContainText('라운드 1 / 8');
  await page.clock.fastForward('00:20');
  await expect(timer).toContainText('휴식');
  await page.getByRole('button', { name: '일시정지' }).click();
  await page.getByRole('button', { name: '리셋' }).click();
  await expect(timer).toBeHidden();
});

test('새 루틴을 만들고 저장한다', async ({ page }) => {
  await page.getByRole('button', { name: '루틴' }).click();
  await page.getByRole('button', { name: '+ 새 루틴' }).click();
  await page.getByPlaceholder('예: 상체 A, 하체 데이').fill('상체 A');
  await page.getByRole('textbox', { name: '1번 종목 이름' }).fill('랫풀다운');
  await page.getByRole('textbox', { name: '무게' }).fill('35');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('랫풀다운 — 3세트 · 35kg × 10')).toBeVisible();

  await page.getByRole('button', { name: '운동', exact: true }).click();
  await expect(page.locator('.routine-card', { hasText: '상체 A' })).toBeVisible();
});
