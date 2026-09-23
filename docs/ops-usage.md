# CrawlSEO Ops 사용법

관철 운영용 로컬 SEO 작업판이다. MCP 원본 툴을 그대로 두고, 실무에서 바로 쓰기 쉽게 `goal → current value → blocker → next action` 형태의 한국어 리포트를 만든다.

## 사이트 ID

- BlogFury: `site_blogfury`
- 키피오: `site_keepioo`
- Peonchi/펀치 여행사이트: `site_peonchi`
- Legacy PunchTravel: `site_punchtravel`

## 기본 명령

```bash
cd /home/user/.hermes/workspace/mcp-servers/crawlseo
npm run ops:board --silent -- --site all --top 5
```

## 새 crawl 후 작업판 생성

```bash
cd /home/user/.hermes/workspace/mcp-servers/crawlseo
npm run ops:board:crawl --silent -- --site all --max-pages 8 --top 5
```

## 사이트 하나만 보기

```bash
npm run ops:board --silent -- --site blogfury
npm run ops:board --silent -- --site keepioo
npm run ops:board --silent -- --site peonchi
npm run ops:board --silent -- --site punchtravel
```

## 편의 실행 파일

```bash
/home/user/.hermes/scripts/crawlseo-ops-board --site all --top 5
/home/user/.hermes/scripts/crawlseo-ops-board --site peonchi --top 5
/home/user/.hermes/scripts/crawlseo-ops-board --site punchtravel --top 3
```

## ops-board 검증 명령

ops-board URL-family policy, markdown rendering, JSON `suppressedIssues` contract, synthetic post-filter 검증은 한 명령으로 돌린다.

```bash
cd /home/user/.hermes/workspace/mcp-servers/crawlseo
npm run test:ops-board
```

예상 성공 output:

```text
ops-url-policy tests passed (12 assertions)
ops-board rendering fixture tests passed (7 assertions)
ops-board JSON contract tests passed (suppressedIssues numeric and explicit)
ops-board post-filter synthetic tests passed (suppression increments; broken/slow remain actionable)
```

작업 전후 smoke/readback은 wrapper로 확인한다.

```bash
/home/user/.hermes/scripts/crawlseo-ops-board --site peonchi --top 5 --out reports/crawlseo/peonchi-readback-$(date +%F)
/home/user/.hermes/scripts/crawlseo-ops-board --site all --top 5 --out reports/crawlseo/latest-readback-$(date +%F)
```

확인 포인트:

- Markdown `## 의도적 제외 요약` 섹션 존재
- 결론 줄에 `의도적 제외: N건` 표시
- JSON `sites[].suppressedIssues`가 숫자로 존재
- Peonchi query/filter/search/account/noindex noise는 action card에서 제외
- `BROKEN_LINK`, `MIXED_CONTENT`, `SLOW_PAGE`는 계속 action card 유지

## 작업 전/후 수동 체크

```bash
# 작업 전: get_crawl_issues + get_opportunities 성격의 TOP 이슈 확인
/home/user/.hermes/scripts/crawlseo_workcheck.py pre punchtravel
/home/user/.hermes/scripts/crawlseo_workcheck.py pre blogfury
/home/user/.hermes/scripts/crawlseo_workcheck.py pre keepioo

# 작업 후: run_crawl → 상태/이슈 재확인
/home/user/.hermes/scripts/crawlseo_workcheck.py post punchtravel
```

## 자동 리포트

```bash
# 격일: 새 crawl 후 세 사이트 비교 → TOP5
/home/user/.hermes/scripts/crawlseo_daily_brief.py

# 주간: health score / issue 감소 / GSC 클릭·노출 변화
/home/user/.hermes/scripts/crawlseo_weekly_brief.py
```

Hermes cron 등록:

- 격일 09:00: `CrawlSEO 격일 SEO TOP5 운영판`
- 매주 월요일 09:00: `CrawlSEO 주간 SEO 변화 리포트`

## 산출물

- 최신 Markdown: `reports/crawlseo/latest.md`
- 최신 JSON: `reports/crawlseo/latest.json`
- timestamped report: `reports/crawlseo/ops-board-*.md/json`

## 검증

```bash
npm run test:ops-board
npx tsc --noEmit
npx eslint lib/ops-url-policy.ts scripts/seo-ops-board.ts scripts/test-ops-url-policy.ts scripts/test-ops-board-rendering.ts scripts/test-ops-board-json-contract.ts scripts/test-ops-board-post-filter.ts
npm run mcp:smoke:ops --silent
PYTHONFAULTHANDLER=1 PYTHONMALLOC=malloc hermes mcp test crawlseo
```

## 안전선

- 이 스크립트는 기본적으로 DB 조회와 리포트 생성만 한다.
- `--crawl`을 붙이면 공개 사이트에 읽기 크롤 요청을 보낸다.
- 실제 사이트 수정, WordPress 반영, 공개 게시, 배포는 별도 승인 경계 안에서 한다.
- GSC 실제 클릭/노출은 GSC sync 연결 전까지 0 또는 starter 데이터로 표시된다.
