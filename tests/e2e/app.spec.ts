import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Seoul', locale: 'ko-KR' });

async function onboard(page: Page, place: RegExp = /헬스장/) {
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('radio', { name: /처음이에요/ }).click();
  await page.getByRole('radio', { name: /주 3회/ }).click();
  await page.getByRole('radio', { name: place }).click();
  await page.getByRole('button', { name: '이 프로그램으로 시작' }).click();
}

async function key(page: Page, digits: string) {
  for (const d of digits) await page.getByRole('group', { name: /입력$/ }).getByRole('button', { name: d, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T19:00:00+09:00') });
  await page.goto('/');
});

test('온보딩 답에 맞는 프로그램을 추천하고 오늘의 루틴을 보여준다', async ({ page }) => {
  await onboard(page);
  await expect(page.getByText('오늘의 루틴')).toBeVisible();
  await expect(page.getByRole('heading', { name: '무분할 A' })).toBeVisible();
  await expect(page.getByText('0/3회')).toBeVisible();
});

test('세트 표로 기록하고 휴식 타이머를 거쳐 운동을 마친다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();

  const squat = page.getByRole('article', { name: '스쿼트' });
  await expect(squat.getByRole('button', { name: '스쿼트 1세트 무게 20kg' })).toBeVisible();

  // 키패드로 무게 입력: 뒤 세트도 같이 바뀐다
  await squat.getByRole('button', { name: '스쿼트 1세트 무게 20kg' }).click();
  await key(page, '40');
  await page.getByRole('button', { name: '다음' }).click();
  await key(page, '8');
  await page.getByRole('button', { name: '키패드 닫기' }).click();
  await expect(squat.getByRole('button', { name: '스쿼트 3세트 무게 40kg' })).toBeVisible();
  await expect(squat.getByRole('button', { name: '스쿼트 1세트 횟수 8회' })).toBeVisible();

  // 세트 완료 → 휴식 타이머 자동 시작
  await squat.getByRole('button', { name: '스쿼트 1세트 완료' }).click();
  const rest = page.getByRole('timer', { name: '휴식 타이머' });
  await expect(rest).toContainText('2:00');
  await rest.getByRole('button', { name: '+15' }).click();
  await expect(rest).toContainText('2:15');
  await page.clock.fastForward('02:16');
  await expect(rest).toBeHidden();
  await expect(page.getByText('휴식 끝! 다음 세트 가볼까요?')).toBeVisible();

  await squat.getByRole('button', { name: '스쿼트 2세트 완료' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();

  // 운동 중 새로고침해도 진행 상황이 남아 있다
  await page.reload();
  await expect(page.getByRole('article', { name: '스쿼트' }).getByRole('button', { name: '스쿼트 2세트 완료 취소' })).toBeVisible();

  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('640kg');
  await page.getByRole('button', { name: '운동 완료' }).click();

  await expect(page.getByRole('heading', { name: '1번째 운동 완료!' })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '최근 운동' })).toBeVisible();
  // 루틴에 오늘 기록이 반영돼 다음엔 B 차례
  await expect(page.getByRole('heading', { name: '무분할 B' })).toBeVisible();
});

test('지난 기록보다 무거우면 PR 알림, 다음엔 증량을 제안한다', async ({ page }) => {
  await onboard(page);
  // 첫 운동: 스쿼트 1세트만
  await page.getByRole('button', { name: '운동 시작' }).click();
  await page.getByRole('button', { name: '스쿼트 1세트 완료' }).click();
  await page.getByRole('button', { name: '스쿼트 2세트 완료' }).click();
  await page.getByRole('button', { name: '스쿼트 3세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByRole('button', { name: '운동 완료' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  // 같은 루틴 다시
  await page.getByRole('button', { name: '루틴', exact: true }).click();
  await page.getByRole('button', { name: '무분할 A 메뉴' }).click();
  await page.getByRole('button', { name: '운동 시작' }).click();
  const squat = page.getByRole('article', { name: '스쿼트' });
  await expect(squat.getByText('지난번 20kg × 10 성공! 오늘은 25kg 어때요?')).toBeVisible();
  await squat.getByRole('button', { name: '적용' }).click();
  await expect(squat.getByRole('button', { name: '스쿼트 3세트 무게 25kg' })).toBeVisible();
  await squat.getByRole('button', { name: '스쿼트 1세트 완료' }).click();
  await expect(page.getByText('새 기록 달성!')).toBeVisible();
  await expect(squat.getByText('PR')).toBeVisible();
});

test('시간 세트(플랭크)는 타이머가 끝나면 자동 완료된다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();
  await page.getByRole('button', { name: '플랭크 1세트 타이머 시작' }).click();
  const work = page.getByRole('timer', { name: '운동 타이머' });
  await expect(work).toContainText('0:30');
  await page.clock.fastForward('00:31');
  await expect(work).toBeHidden();
  await expect(page.getByRole('button', { name: '플랭크 1세트 완료 취소' })).toBeVisible();
  await expect(page.getByRole('timer', { name: '휴식 타이머' })).toBeVisible();
});

test('종목을 초성으로 찾아 루틴을 만든다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '루틴', exact: true }).click();
  await page.getByRole('button', { name: '새 루틴' }).click();
  await page.getByLabel('루틴 이름').fill('등 데이');
  await page.getByRole('button', { name: '운동 추가' }).click();
  await page.getByLabel('종목 검색').fill('ㄹㅍㄷ');
  await page.getByRole('button', { name: /랫풀다운/ }).click();
  await page.getByRole('button', { name: '1개 추가' }).click();
  await expect(page.getByRole('article', { name: '랫풀다운' })).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('등 데이')).toBeVisible();
});

test('인터벌 타이머가 준비 → 운동 → 휴식으로 넘어간다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '타이머', exact: true }).click();
  await page.getByRole('button', { name: /타바타/ }).click();
  await page.getByRole('button', { name: /시작 · 총/ }).click();
  const timer = page.getByRole('timer', { name: '인터벌 타이머' });
  await expect(timer).toContainText('준비');
  await page.clock.fastForward('00:11');
  await expect(timer).toContainText('운동');
  await expect(timer).toContainText('1 / 8');
  await page.clock.fastForward('00:20');
  await expect(timer).toContainText('휴식');
  await page.getByRole('button', { name: '일시정지' }).click();
  await page.getByRole('button', { name: '리셋' }).click();
  await expect(timer).toBeHidden();
});
