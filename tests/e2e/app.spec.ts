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
  await expect(page.getByText(/^오늘/)).toBeVisible();
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
  await page.getByRole('button', { name: '운동 저장' }).click();

  await expect(page.getByText('1번째 운동 저장됨')).toBeVisible();
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
  await page.getByRole('button', { name: '운동 저장' }).click();
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
  // 현재 종목이 아닌 카드는 접혀 있다
  await page.getByRole('article', { name: '플랭크' }).getByRole('button', { expanded: false }).click();
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
  await expect(page.getByText('완료한 1세트는 유지 · 오늘만')).toBeVisible();
  await page.getByRole('region', { name: '추천 대체 운동' }).getByRole('button', { name: /레그 프레스/ }).first().click();

  // 완료한 스쿼트는 요약으로 접힌다. 펼쳐서 확인
  await squat.getByRole('button', { expanded: false }).click();
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
  await page.getByRole('button', { name: '운동 저장' }).click();
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
  await page.getByRole('button', { name: '운동 저장' }).click();
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

test('호텔 짐: 장비 프리셋 → 시작 전 조정 검토 → 끝나면 평소 헬스장과 기본 루틴은 그대로', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '장소: 평소 헬스장' }).click();
  await page.getByRole('button', { name: /다른 곳에서/ }).click();
  // 장비는 미확인 상태에서 시작: 프리셋을 눌러 명시한다
  await expect(page.getByText(/사용할 수 없는 운동 4개/)).toBeVisible();
  await page.getByRole('button', { name: /덤벨 \+ 벤치/ }).click();
  await expect(page.getByText('사용할 수 없는 운동 3개: 스쿼트, 벤치프레스, 랫풀다운')).toBeVisible();
  await page.getByRole('button', { name: '다음 · 조정 3개 검토' }).click();

  // 한 화면에서 대체안 비교: 같은 역할·있는 장비 기준
  const review = page.getByRole('dialog', { name: '시작 전 조정' });
  await expect(review.getByText('고블릿 스쿼트')).toBeVisible();
  await expect(review.getByText('덤벨 벤치프레스')).toBeVisible();
  await expect(review.getByText('원암 덤벨 로우')).toBeVisible();
  await review.getByRole('button', { name: '3개 바꾸고 시작' }).click();

  await expect(page.getByText('무분할 A · 덤벨 + 벤치')).toBeVisible();
  const goblet = page.getByRole('article', { name: '고블릿 스쿼트' });
  await expect(goblet.getByText('스쿼트 대신 · 장비 조정')).toBeVisible();
  await goblet.getByRole('button', { name: '고블릿 스쿼트 1세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  // 다른 장소 기록은 기본 루틴에 반영하지 않는 게 기본
  await expect(page.getByRole('switch', { name: '종목 구성도 바꾸기' })).not.toBeChecked();
  await page.getByRole('button', { name: '운동 저장' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  await expect(page.getByRole('button', { name: '장소: 평소 헬스장' })).toBeVisible();
  await page.getByRole('button', { name: '루틴', exact: true }).click();
  await expect(page.getByRole('button', { name: /무분할 A/ }).first()).toContainText('스쿼트');
});

test('운동 중 교체는 한 시트에서: 사유 칩 → 후보 카드, 되돌리기', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();
  const squat = page.getByRole('article', { name: '스쿼트', exact: true });
  await squat.getByRole('button', { name: '바꾸기' }).click();
  const sheet = page.getByRole('dialog', { name: '운동 변경' });
  await sheet.getByRole('button', { name: '사용 중' }).click();
  // 사용 중이면 같은 랙·바벨을 쓰는 프론트 스쿼트보다 다른 기구 후보가 앞에 온다
  const cards = sheet.getByRole('region', { name: '추천 대체 운동' }).getByRole('button');
  await expect(cards.first()).not.toContainText('프론트 스쿼트');
  await cards.first().click();
  await expect(page.getByRole('article', { name: '스쿼트', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('article', { name: '스쿼트', exact: true })).toBeVisible();
});

test('체성분을 넣으면 단계 추천과 영양 목표가 나온다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '기록', exact: true }).click();
  await page.getByRole('tab', { name: '몸' }).click();
  await page.getByRole('button', { name: '체성분 기록' }).click();
  await page.getByLabel(/체중/).fill('73.3');
  await page.getByLabel(/체지방률/).fill('21');
  await page.getByLabel(/골격근량/).fill('33.1');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('73.3kg', { exact: true })).toBeVisible();
  await expect(page.getByText('2,230').first()).toBeVisible(); // 주 3회 기준 유지 열량 = 목표 열량(목표 없음)
  await page.getByRole('button', { name: '프로필 · 목표' }).click();
  await page.getByRole('radio', { name: '남', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/추천: 리컴프/)).toBeVisible();
  await page.getByRole('radio', { name: '리컴프' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByText('130g')).toBeVisible();
});

test('P0: PPL Pull A를 덤벨만으로 조정하면 같은 종목 몰림이 없고, 후보 없음은 멈춘다', async ({ page }) => {
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('radio', { name: /꾸준히/ }).click();
  await page.getByRole('radio', { name: /거의 매일/ }).click();
  await page.getByRole('radio', { name: /헬스장/ }).click();
  await page.getByRole('button', { name: '이 프로그램으로 시작' }).click();
  // 오늘 차례는 밀기 A. 한 세트만 하고 저장해 차례를 당기기 A로 넘긴다
  await page.getByRole('button', { name: '운동 시작' }).click();
  await page.getByRole('button', { name: '벤치프레스 1세트 완료' }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByRole('button', { name: '운동 저장' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '당기기 A (등 넓이)' })).toBeVisible();

  await page.getByRole('button', { name: '장소: 평소 헬스장' }).click();
  await page.getByRole('button', { name: /다른 곳에서/ }).click();
  await page.getByRole('button', { name: '덤벨', exact: true }).click();
  await expect(page.getByText(/사용할 수 없는 운동 5개/)).toBeVisible();
  await page.getByRole('button', { name: /다음 · 조정 5개 검토/ }).click();

  const review = page.getByRole('dialog', { name: '시작 전 조정' });
  await expect(review.getByText('백 익스텐션')).toHaveCount(0);
  await expect(review.getByText('덤벨 숄더 프레스')).toHaveCount(0);
  await expect(review.getByText('벤트오버 리어 델트 레이즈')).toBeVisible();
  await expect(review.getByText('벤트오버 덤벨 로우')).toHaveCount(1);
  await expect(review.getByText('현재 장비로 비슷하게 바꾸기 어려워요').first()).toBeVisible();
  // 해결 안 된 하나를 오늘 제외
  await review.getByRole('button', { name: '오늘 제외' }).first().click();
  await review.getByRole('button', { name: /바꾸고 .*빼고 시작|바꾸고 시작/ }).click();

  // 운동 목록: 같은 종목이 둘 이상 없고 백익스텐션이 없다
  const names = await page.getByRole('article').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(names.length);
  expect(names).not.toContain('백 익스텐션');
});

test('운동 설명을 열고 닫아도 입력값·현재 세트·휴식 타이머가 그대로다', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: '운동 시작' }).click();
  const squat = page.getByRole('article', { name: '스쿼트', exact: true });
  await squat.getByRole('button', { name: '스쿼트 1세트 무게 20kg (시작값)' }).click();
  await key(page, '30');
  await page.getByRole('button', { name: '키패드 닫기' }).click();
  await squat.getByRole('button', { name: '스쿼트 1세트 완료' }).click();
  await expect(page.getByRole('timer', { name: '휴식 타이머' })).toBeVisible();
  await squat.getByRole('button', { name: '스쿼트 운동 설명' }).click();
  const guide = page.getByRole('dialog', { name: '스쿼트 · 운동 설명' });
  await expect(guide.getByText('필요 장비')).toBeVisible();
  await expect(guide.getByText(/휴식 \d:\d\d/)).toBeVisible();
  await page.clock.runFor(5000);
  await guide.getByRole('button', { name: '닫기' }).click();
  await expect(squat.getByRole('button', { name: '스쿼트 1세트 무게 30kg' })).toBeVisible();
  await expect(squat.getByRole('button', { name: '스쿼트 1세트 완료 취소' })).toBeVisible();
  await expect(page.getByRole('timer', { name: '휴식 타이머' })).toContainText('1:5');
  await expect(page.locator('.set-row.is-current').getByRole('button', { name: '스쿼트 2세트 완료' })).toBeVisible();
});
