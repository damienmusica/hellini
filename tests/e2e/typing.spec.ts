import { expect, test } from '@playwright/test';

// 가짜 시계 없이 실제 시간으로: 운동 화면은 0.25초마다 다시 그려지는데,
// 그때마다 시트가 포커스를 가져가 한 글자만 입력되던 버그의 회귀 테스트
test('운동 중에도 종목 검색에 한 글자씩 끊기지 않고 입력된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('radio', { name: /처음이에요/ }).click();
  await page.getByRole('radio', { name: /주 3회/ }).click();
  await page.getByRole('radio', { name: /헬스장/ }).click();
  await page.getByRole('button', { name: '이 프로그램으로 시작' }).click();
  await page.getByRole('button', { name: '운동 시작' }).click();
  await page.getByRole('button', { name: '운동 추가' }).click();

  const search = page.getByLabel('종목 검색');
  await search.click();
  await search.pressSequentially('hammer', { delay: 300 });
  await expect(search).toHaveValue('hammer');
  await page.getByRole('button', { name: /해머 컬/ }).click();
  await page.getByRole('button', { name: '1개 추가' }).click();
  await expect(page.getByRole('article', { name: '해머 컬' })).toBeVisible();
});
