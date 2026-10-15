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
  // 목표 10~13회라 10회만 채운 날은 무게가 아니라 횟수부터 올린다 (이중 진행)
  const squat = page.getByRole('article', { name: '스쿼트' });
  await expect(squat.getByText('지난번 20kg × 10·10·10. 오늘은 같은 무게로 11·11·11회 어때요?')).toBeVisible();
  await squat.getByRole('button', { name: '적용' }).click();
  await expect(squat.getByRole('button', { name: '스쿼트 3세트 횟수 11회' })).toBeVisible();
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

// 2026-10-15 리뷰 리포트 재현 시나리오
test('P0: 스쿼트 1세트 후 레그 프레스로 바꿔도 완료 세트는 스쿼트로 남고, 기본 루틴은 그대로', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();
  const squat = page.getByRole('article', { name: '스쿼트' });
  await squat.getByRole('button', { name: '스쿼트 1세트 무게 20kg' }).click();
  await key(page, '25');
  await page.getByRole('button', { name: '키패드 닫기' }).click();
  await squat.getByRole('button', { name: '스쿼트 1세트 완료' }).click();

  await squat.getByRole('button', { name: '스쿼트 메뉴' }).click();
  await page.getByRole('button', { name: '남은 세트만 다른 종목으로' }).click();
  await page.getByRole('button', { name: '다른 운동이 하고 싶어요' }).click();
  await expect(page.getByText('완료한 1세트는 스쿼트 기록으로 남고')).toBeVisible();
  await page.getByRole('region', { name: '추천 대체 운동' }).getByRole('button', { name: /레그 프레스/ }).click();

  await expect(squat.getByRole('button', { name: '스쿼트 1세트 완료 취소' })).toBeVisible();
  await expect(squat.getByRole('button', { name: /스쿼트 2세트/ })).toHaveCount(0);
  const press = page.getByRole('article', { name: '레그 프레스' });
  await expect(press.getByRole('button', { name: /레그 프레스 \d세트 완료$/ })).toHaveCount(2);
  // 스쿼트 25kg을 옮기지 않는다
  await expect(press.getByRole('button', { name: '레그 프레스 1세트 무게 10kg' })).toBeVisible();

  await press.getByRole('button', { name: '레그 프레스 1세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('스쿼트 → 레그 프레스')).toBeVisible();
  await expect(dialog.getByRole('switch', { name: '종목 구성도 바꾸기' })).not.toBeChecked();
  await page.getByRole('button', { name: '운동 완료' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  // 기본 루틴은 그대로 스쿼트
  await page.getByRole('button', { name: '루틴', exact: true }).click();
  await expect(page.getByText('스쿼트 · 벤치프레스 · 랫풀다운 · 덤벨 숄더 프레스 · 플랭크')).toBeVisible();

  // 기록에는 둘이 따로
  await page.getByRole('button', { name: '기록', exact: true }).click();
  await page.locator('.session-card').first().click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText('25kg × 10')).toBeVisible();
  await expect(detail.getByText('레그 프레스')).toBeVisible();
});

test('P1: 끝난 기록의 무게를 고치면 상세와 통계에 반영된다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();
  await page.getByRole('button', { name: '스쿼트 1세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByRole('button', { name: '운동 완료' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  await page.getByRole('button', { name: '기록', exact: true }).click();
  await page.locator('.session-card').first().click();
  await page.getByRole('button', { name: '기록 고치기' }).click();
  await page.getByRole('button', { name: '스쿼트 1세트 무게 20kg' }).click();
  await key(page, '30');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('기록을 고쳤어요')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('30kg × 10')).toBeVisible();

  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('tab', { name: '종목별' }).click();
  await expect(page.getByText('최고 30kg')).toBeVisible();
});

test('호텔 짐: 등록 없이 장비만 고르고, 없는 기구 종목을 바꾸고, 끝나면 평소 헬스장과 기본 루틴은 그대로', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '장소: 평소 헬스장' }).click();
  await page.getByRole('button', { name: /다른 곳에서/ }).click();
  // 기본 체크: 덤벨·머신·케이블 → 바벨 종목(스쿼트·벤치프레스)은 못 한다
  await expect(page.getByText(/스쿼트, 벤치프레스은\(는\) 여기 기구가 없어요/)).toBeVisible();
  await page.getByRole('button', { name: '이 장비로 할게요' }).click();
  await expect(page.getByRole('button', { name: '장소: 다른 헬스장' })).toContainText('2종목 기구 없음');

  await page.getByRole('button', { name: '운동 시작' }).click();
  await expect(page.getByText('무분할 A · 다른 헬스장')).toBeVisible();
  const squat = page.getByRole('article', { name: '스쿼트' });
  await expect(squat.getByText('여기엔 없는 기구예요')).toBeVisible();
  await squat.getByRole('button', { name: '바꾸기' }).click();
  const picks = page.getByRole('region', { name: '추천 대체 운동' });
  await expect(picks.getByRole('button', { name: /바벨/ })).toHaveCount(0);
  await picks.getByRole('button', { name: /레그 프레스/ }).click();
  const legPress = page.getByRole('article', { name: '레그 프레스' });
  await expect(legPress.getByText('스쿼트 대신 · 기구 없음')).toBeVisible();
  await legPress.getByRole('button', { name: '레그 프레스 1세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  // 다른 장소 기록은 기본 루틴에 반영하지 않는 게 기본
  await expect(page.getByRole('switch', { name: '종목 구성도 바꾸기' })).not.toBeChecked();
  await page.getByRole('button', { name: '운동 완료' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  await expect(page.getByRole('button', { name: '장소: 평소 헬스장' })).toBeVisible();
  await page.getByRole('button', { name: '루틴', exact: true }).click();
  await expect(page.getByRole('button', { name: /무분할 A/ }).first()).toContainText('스쿼트');
});
