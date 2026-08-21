# 🔍 Wallet 프로젝트 종합 리뷰

> **리뷰 대상:** `D:\Projects\wallet`  
> **리뷰 일시:** 2026-08-15  
> **현재 브랜치:** `codex/fix-cold-vault-usdt-log`  
> **최근 커밋:** `c4de3d0` Fix cold vault transfer log tx tracking

---

## 1. 프로젝트 개요

BSC (BNB Smart Chain) 기반 **중앙화 멀티 토큰 지갑 플랫폼**으로, 사용자 웹앱, 관리자 백오피스, 블록체인 동기화 워커, Supabase DB 백엔드로 구성된 **Monorepo** 시스템입니다.

| 항목 | 내용 |
|------|------|
| **지원 네트워크** | BSC Mainnet (Chain ID: 56) |
| **지원 자산** | USDT (BEP-20), URC/BAO (자체 토큰), BNB (가스비), Jade Beads (게임 재화), Hongbao (보너스) |
| **핵심 비즈니스** | 입금/출금, USDT↔URC 스왑(수수료 0.1%), 게임 머신(369), 추천인 트리(369 롤업), 마케팅 보너스 정산 |
| **사용자 언어** | 중국어(zh) / 영어(en) / 한국어(ko) (사용자 웹), 한국어 전용 (관리자) |

---

## 2. 시스템 아키텍처

```
wallet/
├── apps/
│   ├── user-web/          # 사용자 PWA 웹앱 (Next.js 16)
│   └── admin/             # 관리자 백오피스 (Next.js 16)
├── supabase/
│   ├── config.toml        # Supabase 로컬 설정
│   ├── migrations/        # 24개 SQL 마이그레이션
│   └── qa/                # QA 테스트 스크립트
├── workers/
│   ├── rpc-watcher/       # BSC 블록체인 입금 동기화 데몬
│   └── settlement-cron/   # 일일 정산 & 보너스 크론 데몬
├── docs/                  # 9개 기술 문서
├── vercel.json            # 루트 Vercel Cron 설정
├── README.md              # 프로젝트 기술 사양서 (한국어)
└── ROADMAP.md             # 개발 마일스톤 가이드
```

### 2.1 구성요소별 역할

| 구성요소 | 기술 스택 | 역할 |
|----------|----------|------|
| **user-web** | Next.js 16, React 19, Tailwind v4 | 모바일 사용자 지갑, 게임, 조직, 설정 |
| **admin** | Next.js 16, React 19, Tailwind v4 | 대시보드, 회원관리, 출금 승인, 지갑 운영, 설정 |
| **Supabase** | PostgreSQL 17, RLS, Edge Functions | 인증, DB, 실시간 구독, 서버리스 API |
| **rpc-watcher** | Node.js, ethers v6, pg | BSC 블록 스캔 → USDT 입금 감지 → 원장 기록 |
| **settlement-cron** | Node.js, node-cron, pg | 일일 369 게임 보너스 정산 및 마케팅 수당 분배 |
| **Vercel Cron** | vercel.json | 매일 자정 자동 추첨 / 자동 베팅 실행 |

---

## 3. 기술 스택 상세

### 3.1 공통 프론트엔드 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `next` | 16.2.10 | 프레임워크 (App Router) |
| `react` / `react-dom` | 19.2.4 | UI 라이브러리 |
| `typescript` | ^5 | 타입 안전성 |
| `tailwindcss` | ^4 | 스타일링 (`@tailwindcss/postcss`) |
| `@supabase/ssr` | ^0.12.3~4 | 서버 사이드 Supabase 인증 |
| `@supabase/supabase-js` | ^2.110.7 | Supabase 클라이언트 |
| `ethers` | ^6.17.0 | 블록체인 상호작용 |
| `pg` | ^8.22.0 | 직접 PostgreSQL 연결 (API Routes) |
| `lucide-react` | ^1.25.0 | 아이콘 라이브러리 |
| `eslint` | ^9 | 린터 |

### 3.2 Worker 전용

| 패키지 | 용도 |
|--------|------|
| `ethers` (^6.13.1) | rpc-watcher: BSC 블록 스캔 |
| `node-cron` (^3.0.3) | settlement-cron: 스케줄링 |
| `dotenv` (^16.4.5) | 환경변수 로드 |

### 3.3 NOT 사용 중인 라이브러리

- ❌ UI 컴포넌트 라이브러리 (shadcn, MUI, Chakra, Radix 등)
- ❌ 폼 라이브러리 (react-hook-form, formik, zod)
- ❌ 차트 라이브러리 (recharts, chart.js, d3)
- ❌ 상태 관리 라이브러리 (Redux, Zustand, Jotai)
- ❌ i18n 라이브러리 (i18next, next-intl) — 커스텀 인파일 구현
- ❌ React Native 모바일 앱 — README에 명시되어 있으나 **미구현** (웹 전용)

---

## 4. 데이터베이스 설계

### 4.1 스키마 개요

24개 마이그레이션 파일 (2026-07-20 ~ 2026-08-14)로 구성:

| 테이블 | 용도 | 주요 특징 |
|--------|------|----------|
| `users` | 사용자 프로필 | RLS (`auth.uid() = id`), status 체크 제약 |
| `user_wallets` | 유저별 BSC 입금 주소 | HD 지갑 인덱스, UNIQUE 주소 |
| `assets` | 자산 종류 마스터 | USDT, URC, BNB 등 |
| `user_balances` | 내부 잔고 (복식부기) | available/locked 분리, CHECK (≥0) |
| `ledger_entries` | 통합 거래 원장 | tx_hash UNIQUE (멱등성), JSONB details |
| `game_rounds` | 게임 라운드 | 일일 추첨 관리 |
| `game_participants` | 게임 참여자 | 베팅, 당첨/낙첨 기록 |
| `settings` | 시스템 설정 | 수수료율, 최소 출금액 등 |
| `sweep_requests` | 입금 자산 집계 이력 | 모니터링 감사 추적 |
| `vault_transfers` | 볼트 간 이체 | Master ↔ Cold Vault |
| `bsc_usdt_deposits` | BSC USDT 입금 이벤트 | chain_event_key UNIQUE (중복 방지) |
| `chain_sync_cursors` | 블록체인 동기화 커서 | 마지막 스캔 블록 추적 |

### 4.2 보안 모델

- **Row-Level Security (RLS):** 모든 주요 테이블에 적용
- **Service Role Key:** Admin API 및 Worker에서 RLS 우회
- **멱등성:** `tx_hash UNIQUE` + `ON CONFLICT DO NOTHING`
- **ACID 트랜잭션:** 잔고 조정과 원장 기록을 단일 트랜잭션으로 묶음
- **CHECK 제약:** 잔고 음수 방지 (`available_balance >= 0`)

---

## 5. API 라우트 구조

### 5.1 사용자 웹 (user-web) — 18개 API

| 카테고리 | 엔드포인트 | 기능 |
|----------|-----------|------|
| **Auth** | `/api/auth/register` | 회원가입 |
| | `/api/auth/confirm-email` | 이메일 확인 |
| | `/api/auth/record-login` | 로그인 기록 |
| | `/api/auth/verify-email` | 이메일 검증 |
| | `/api/auth/send-verification` | 검증 이메일 발송 |
| | `/api/auth/reset-password-request` | 비밀번호 재설정 요청 |
| | `/api/auth/reset-password-confirm` | 비밀번호 재설정 확인 |
| **Wallet** | `/api/wallet/generate` | 지갑 주소 생성 |
| | `/api/withdraw` | 출금 신청 |
| **User** | `/api/user/balance` | 잔고 조회 |
| | `/api/user/history` | 거래 내역 |
| | `/api/user/bets` | 베팅 내역 |
| | `/api/user/machines` | 보유 게임 기계 |
| **Game** | `/api/game-rounds` | 게임 라운드 목록 |
| | `/api/game-rounds/participate` | 게임 참여 |
| **Network** | `/api/network` | 조직도 트리 |
| **Package** | `/api/package/purchase` | 상품 구매 |
| **Etc** | `/api/activate`, `/api/auto-bet-settings` | 활성화, 자동 베팅 설정 |
| **Cron** | `/api/cron/auto-bet` | 자동 베팅 크론 |

### 5.2 관리자 (admin) — 16개 API

| 카테고리 | 엔드포인트 | 기능 |
|----------|-----------|------|
| **Dashboard** | `/api/dashboard/stats` | 통계 데이터 |
| **Users** | `/api/users`, `/api/users/[id]/details`, `/api/users/[id]/organization` | 회원 관리 |
| **Withdrawals** | `/api/withdrawals` | 출금 승인/반려 |
| **Transactions** | `/api/transactions` | 원장 조회 |
| **Wallet** | `/api/wallet/status`, `/api/wallet/sweep`, `/api/wallet/cold-vault-log`, `/api/wallet/setup`, `/api/wallet/fee-status` | 지갑 운영 |
| **Deposits** | `/api/deposits/sync` | BSC USDT 입금 동기화 |
| **Game** | `/api/game-rounds`, `/api/game-rounds/draw` | 게임 관리 |
| **Settings** | `/api/settings/save`, `/api/settings/auto-draw` | 시스템 설정 |
| **BNB** | `/api/bnb-transfer` | BNB 온체인 전송 |
| **Recharge** | `/api/recharge` | 수동 충전 (테스트용) |
| **Cron** | `/api/cron/auto-draw`, `/api/cron/bsc-usdt-deposit-sync` | 자동 추첨, 입금 동기화 |

---

## 6. 페이지 구성

### 6.1 사용자 웹 (user-web)

| 라우트 | 설명 |
|--------|------|
| `/` | **메인 SPA** — 홈, 지갑, 상점, 게임, 조직, 설정 6탭 (3,233행 단일 파일) |
| `/login` | 닉네임+비밀번호 로그인 |
| `/register` | 이메일 검증 포함 다단계 회원가입 |
| `/reset-password` | 비밀번호 재설정 |
| `/deposit` | 입금 페이지 (레거시) |
| `/auth/callback` | Supabase OAuth 콜백 |

- **네비게이션:** 하단 고정 탭 바 (홈/지갑/상품/게임/조직/설정)
- **PWA 지원:** apple-mobile-web-app 메타 태그, PwaPrompt 설치 가이드

### 6.2 관리자 (admin)

| 라우트 | 설명 |
|--------|------|
| `/` | 대시보드 — 통계, 출금 승인, 원장, 차트 |
| `/login` | 관리자 로그인 |
| `/users` | 회원 목록/검색/상세 |
| `/users/[id]/organization` | 조직도 트리 |
| `/wallet` | 마스터 지갑, 콜드볼트, 스윕 관리 |
| `/bnb-transfer` | BNB 온체인 전송 툴 |
| `/withdrawals` | 출금 승인/반려 페이지 |
| `/transactions` | 전체 원장 조회 (필터/검색/페이지네이션) |
| `/settings` | 시스템 설정 (지갑 주소, 수수료, 부관리자, 지갑 생성) |
| `/settings/rounds` | 게임 라운드 CRUD |

- **네비게이션:** 고정 사이드바 (w-64) + 상단 헤더바

---

## 7. 디자인 시스템

### 7.1 테마

**Binance-inspired 다크 테마** (두 앱 공통):

| 토큰 | 색상 | 용도 |
|------|------|------|
| `#0C0C0E` | 배경 |
| `#16161A` | 카드/패널 |
| `#26262B` | 보더 |
| `#F2F2F7` | 기본 텍스트 |
| `#8E8E93` | 보조 텍스트 |
| `#FCD535` (골드) | 🏆 브랜드 액센트 |
| `#0ECB81` (녹색) | ✅ 성공/양수/활성 |
| `#F6465D` (빨강) | ❌ 오류/음수 |
| `#00D2FF` (시안) | 🔵 관리자 액센트 |
| `#BF5AF2` (보라) | 🟣 관리자 보조 |
| `#FF9F0A` (주황) | ⚠️ 대기/경고 |
| `#30D5C8` (틸) | ℹ️ 정보/콜드월렛 |

### 7.2 UI 특징

- Tailwind v4 전용 (no CSS Modules, no styled-components)
- `backdrop-blur` 글래스모피즘 효과
- 네온 글로우 `box-shadow` 효과
- `max-w-md mx-auto` 모바일 뷰포트 제한 (user-web)
- 커스텀 스크롤바 숨김 `.no-scrollbar`
- SVG 수작업 트렌드 차트 (데이터 연동 미완)

---

## 8. 코드 품질 분석

### 8.1 강점 ✅

| 항목 | 설명 |
|------|------|
| **TypeScript 도입** | 전체 프로젝트 TypeScript 적용으로 타입 안전성 확보 |
| **복식부기 원장** | `ledger_entries` + `user_balances` 분리 설계로 정합성 보장 |
| **멱등성 보장** | `tx_hash UNIQUE` 제약으로 블록체인 중복 입금 처리 방지 |
| **RLS 보안** | 모든 사용자 테이블에 Row-Level Security 적용 |
| **환경변수 안전 처리** | `createSafeClient()` 패턴으로 빌드 타임 env 누락 방지 |
| **Cron 인증 분리** | `/api/cron/*` 경로를 middleware에서 세션 갱신 제외 |
| **체인 설정 중앙화** | `chain-config.ts`에서 RPC URL, 컨트랙트 주소 일원관리 |
| **QA 자동화** | 40명 가입/구매/베팅 시나리오 QA 스크립트 존재 |
| **문서화 수준** | README, ROADMAP, 9개 기술 문서, QA 리포트 |

### 8.2 개선 필요 사항 ⚠️

| 우선순위 | 항목 | 설명 |
|----------|------|------|
| 🔴 **높음** | **거대 단일 컴포넌트** | `user-web/src/app/page.tsx`이 **3,233행**으로 6개 탭, 80+ useState를 한 파일에 포함. 유지보수/테스트가 매우 어려움 |
| 🔴 **높음** | **컴포넌트 재사용 부재** | 두 앱 합쳐 컴포넌트 3개 (`PwaPrompt`, `AdminLayoutWrapper`, `LogoutButton`). 버튼, 카드, 모달, 테이블 등 공통 패턴이 인라인 중복 |
| 🔴 **높음** | **DB 커넥션 풀 과다 생성** | 30+개 API 라우트가 각각 `new Pool({ connectionString: ... })`을 개별 생성. 커넥션 풀 고갈 위험. 단일 풀로 중앙화 필요 |
| 🔴 **높음** | **SSL 검증 비활성화** | 31개 라우트 파일에서 `ssl: { rejectUnauthorized: false }` 사용. Supabase 연결이므로 당장의 문제는 없으나 보안 모범 사례 위반 |
| 🟡 **보통** | **UI 라이브러리 미사용** | shadcn/ui 같은 접근성 내장 컴포넌트 없이 모든 것을 Tailwind로 수작업 |
| 🟡 **보통** | **폼 처리** | react-hook-form/zod 미사용으로 수동 유효성 검증 중복 |
| 🟡 **보통** | **상태 관리** | 전역 상태 관리 라이브러리 없이 컴포넌트별 useState 의존 |
| 🟡 **보통** | **차트 하드코딩** | 관리자 대시보드 차트가 SVG 인라인으로 하드코딩, 실제 데이터 미연동 |
| 🟡 **보통** | **Mock 클라이언트 조용히 활성화** | 환경변수 누락/플레이스홀더 시 Mock Supabase 클라이언트가 **경고 없이** 활성화. 프로덕션 배포 시 env 설정 실수로 Mock 데이터 서비스 가능 |
| 🟡 **보통** | **출금 수수료 하드코딩** | 3% 수수료율 및 0.97 역수치가 **12개 이상 위치**에 분산. `system_settings` 테이블에 키가 있으나 일관되게 사용되지 않음 |
| 🟡 **보통** | **공통 코드 중복** | 두 앱 간 Supabase 클라이언트, cron-auth 등이 거의 동일하게 복제. `packages/shared` 같은 공유 패키지 없음 |
| 🟡 **보통** | **React Native 미구현** | README/ROADMAP에 모바일 앱 명시되어 있으나 **실제로는 웹 전용** |
| 🟡 **보통** | **프로덕션 console.log** | login 페이지에서 이메일, 로그인 결과 등 **사용자 데이터를 console.log**로 출력 (6곳). 브라우저 개발자 콘솔 노출 |
| 🟡 **보통** | **에러 메시지 노출** | `err.message`를 API 응답에 직접 포함하여 내부 구현 세부사항 유출 가능성 |
| 🟡 **보통** | **`.env.example` 부재** | 새 개발자를 위한 환경변수 템플릿 문서가 없음 (12개 이상의 env 키 사용 중) |
| 🟢 **낮음** | **Default Next.js SVGs** | `public/`에 `file.svg`, `globe.svg`, `vercel.svg` 등 보일러플레이트 파일 잔류 |
| 🟢 **낮음** | **PWA 미완** | PwaPrompt 컴포넌트 존재하나 `manifest.json`이나 Service Worker 파일 없음 |
| 🟢 **낮음** | **Monorepo 관리 부재** | 루트 `package.json` 없음. Turborepo/Nx/Lerna 미사용 — 각 앱/워커가 독립적 |
| 🟢 **낮음** | **CI/CD 미설정** | GitHub Actions, Dockerfile 등 자동 빌드/테스트/배포 파이프라인 없음 |
| 🟢 **낮음** | **CSRF/Rate-limiting 미비** | 인증 엔드포인트 (로그인, 회원가입, 비밀번호 재설정)에 rate-limiting 없음 |
| 🟢 **낮음** | **Next.js middleware.ts 미연결** | 두 앱 모두 `lib/supabase/middleware.ts`에 `updateSession()`이 있으나 Next.js 미들웨어 엔트리포인트에서 연결 확인 필요 |
| 🟢 **낮음** | **테스트 파일 잔류** | 루트에 `test-api.js`, `test-db.js`, 각 앱에 `test-insert.js`, `debug.js` 등 배포 불필요 파일 |

### 8.3 구조적 리스크

```
user-web/src/app/page.tsx  ← 3,233행, 단일 파일 SPA
├── 홈 탭 (대시보드)
├── 지갑 탭 (잔고/입출금/스왑)
├── 상점 탭 (게임 기계 구매)
├── 게임 탭 (369 베팅)
├── 조직 탭 (추천/후원 트리)
└── 설정 탭 (언어/보안)
```

**권장 개선:** 각 탭을 독립 컴포넌트로 분리하고, 공통 UI 원자/분자 컴포넌트를 추출.

---

## 9. 보안 현황

### 9.1 보안 강점

| 항목 | 구현 |
|------|------|
| **인증** | Supabase Auth + SSR 미들웨어 세션 관리 |
| **권한 분리** | RLS (사용자) vs Service Role (관리자/워커) |
| **Cron 인증** | `cron-auth.ts`로 크론 엔드포인트 시크릿 검증 |
| **키 관리** | 지갑 개인키는 환경변수/암호화 저장, 메모리에서만 복호화 |
| **중복 방지** | DB UNIQUE 제약 + ON CONFLICT |
| **잔고 무결성** | CHECK 제약 + ACID 트랜잭션 |
| **입금 멱등성** | `bsc_usdt_deposits` 테이블에 chain_event_key UNIQUE |
| **비상 정지** | 동기화 락 (`bsc_usdt_sync_lock`)으로 동시 실행 방지 |

### 9.2 주의 필요

| 항목 | 설명 |
|------|------|
| 🔴 **`.env` 파일 커밋** | 루트 `.env` 파일에 **실제 Supabase URL, Anon Key, Service Role Key, Database URL**이 포함되어 리포지토리에 커밋됨. **즉시 `.gitignore`에 추가하고 key rotation을 수행할 것을 강력히 권장** |
| **pg 직접 연결** | API Routes에서 `pg` 드라이버로 DB 직접 접속. Supabase 클라이언트와 혼용 중 |
| **환경변수 체인** | `chain-config.ts`에서 4개 환경변수를 폴백 체인으로 확인 — 하나라도 잘못 설정되면 의도치 않은 동작 가능 |
| **Mock 모드** | Admin에 Mock Supabase 클라이언트 포함 (`ALLOW_MOCK_SUPABASE=true` 시 활성) |
| **하드코딩 지갑** | 마스터 핫월렛 주소 `0x781d...B9A4`가 `master-hot-wallet.ts:6`에 하드코딩. DB 설정이 비면 모든 BNB 전송이 이 주소로 향함 |

---

## 10. 배포 환경

| 항목 | 내용 |
|------|------|
| **플랫폼** | Vercel (Monorepo 배포) |
| **프레임워크** | Next.js (자동 인식) |
| **Cron Jobs** | user-web: 매일 자정 auto-bet / admin: 매일 자정 auto-draw |
| **DB** | Supabase Cloud (PostgreSQL 17) |
| **Worker** | 별도 프로세스 (PM2 또는 Docker) — Vercel 외부 |
| **문서** | `docs/ADMIN_VERCEL_DEPLOYMENT.md`, `docs/USER_WEB_VERCEL_DEPLOYMENT.md` |
| **CI/CD** | ❌ 없음 — GitHub Actions, Docker, 자동 파이프라인 미설정 |

### 10.2 필요 환경변수 (12개)

`.env.example` 파일이 없어 전체 목록을 문서화합니다:

| 변수명 | 용도 | 필수 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 (Supabase pooler) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 관리자 키 | ✅ |
| `ADMIN_EMAILS` | 관리자 이메일 화이트리스트 (콤마 구분) | ✅ |
| `CRON_SECRET` | Cron 엔드포인트 HMAC 인증 시크릿 | ✅ |
| `BSC_RPC_URL` | BSC RPC 엔드포인트 | ✅ |
| `BSC_DEPOSIT_RPC_URL` | 입금 인덱싱 전용 RPC | 선택 |
| `USDT_CONTRACT_ADDRESS` | USDT BEP-20 컨트랙트 주소 | ✅ |
| `MASTER_HOT_WALLET_PRIVATE_KEY` | 마스터 핫월렛 개인키 | ✅ |
| `WALLET_MASTER_MNEMONIC` | HD 지갑 마스터 니모닉 | ✅ |
| `EMAIL_FROM` | 이메일 발신자 주소 | ✅ |

---

## 11. 커밋 히스토리 요약 (최근 30커밋)

| 기간 | 주요 활동 |
|------|----------|
| 최신 | 콜드볼트 USDT 전송 로그 추적 수정, 관리자 회원 삭제 정리, 거래내역 UI 개선 |
| 8월 중순 | 온체인 콜드볼트 전송 활성화, BSC USDT 입금 인덱서 구현, 마스터 핫월렛 통합 |
| 8월 초 | 369 스폰서 롤업/마마 보너스 수정, 게임 참여/정산 수정, PWA 배포 문서화 |
| 7월 말 | BSC 입금 동기화, 지갑 스윕, 네트워크 트리, 구매/추천인 플로우 구현 |

**개발 속도:** 빠르고 활발 — 2주 이내 30+ 커밋, 기능 확장과 버그 수정 병행

---

## 12. 파일 통계

| 항목 | 수량 |
|------|------|
| **TS/TSX 파일 (apps/)** | ~86개 |
| **TS/TSX 파일 (workers/)** | ~4개 |
| **SQL 마이그레이션** | 24개 |
| **문서 (docs/)** | 9개 |
| **API 라우트 (user-web)** | 18개 |
| **API 라우트 (admin)** | 16개 |
| **총 API 라우트** | 34개 |
| **페이지 (user-web)** | 5개 |
| **페이지 (admin)** | 10개 |

---

## 13. 종합 평가

### ⚡ 추가 발견 사항

| 항목 | 상세 |
|------|------|
| **369 롤업 로직** | PostgreSQL 트리거 `handle_user_activation()`으로 구현 — 3번째, 6번째, 9번째 추천인이 조부모 스폰서로 패스업 |
| **정산 워커** | `settlement-cron`은 매일 UTC 16:00 (=베이징 00:00) 실행 — 추천 20%, 육성 10%, 마마 100% 매칭, 최탄 10% 풀, 직급 7계층 풀 보너스 정산 |
| **게임 시스템** | 일일 3회 추첨 (11:00/14:00/17:00 CST), Jade Beads 베팅, AI 추첨, 102% USDT 승리 배당 |
| **rpc-watcher** | 레거시 USDT 리스너 비활성화 — 현재 admin 앱의 BSC USDT deposit sync가 권위 경로 |
| **DB 함수** | `settle_machine_purchase()` — 369 배치 및 마마 보너스 계산을 DB 레벨에서 처리 |
| **복식부기 유형** | DEPOSIT, WITHDRAW, SWAP_IN/OUT, REFERRAL_BONUS, FOSTER_BONUS, MAMA_BONUS, CHEOTAN_BONUS, RANK_BONUS, RANK_STAR_BONUS |

### 📊 점수

| 평가 항목 | 점수 (10점 만점) | 비고 |
|----------|-----------------|------|
| **기능 완성도** | 8.5 | 지갑, 게임, 조직, 정산 등 핵심 기능 대부분 구현 |
| **보안 모델** | 7.5 | RLS, 멱등성, ACID 트랜잭션 철저하나 `.env` 커밋은 큰 리스크 |
| **DB 설계** | 8.0 | 복식부기, CHECK 제약, 체인 이벤트 추적 |
| **문서화** | 7.5 | README, ROADMAP, QA 리포트, 기술 문서 충실 |
| **아키텍처** | 6.5 | Monorepo 구조는 좋으나 컴포넌트 분리 미흡 |
| **코드 품질** | 5.5 | 거대 단일 파일, 컴포넌트 재사용 부재 |
| **테스트 자동화** | 4.0 | QA 스크립트 있으나 유닛/통합 테스트 프레임워크 미사용 |
| **UI/UX 완성도** | 7.0 | 다크 테마 일관성 좋음, 차트는 미연동 |
| **배포 파이프라인** | 7.5 | Vercel 자동 배포, Cron 통합 잘됨 |

### 🎯 총평

> **"기능 확장이 빠르고 비즈니스 로직이 탄탄한 프로젝트이나, 코드 아키텍처 리팩토링이 시급한 단계"**

이 프로젝트는 BSC 기반 지갑 플랫폼으로서 핵심 비즈니스 로직(입출금, 스왑, 게임, 조직도, 보너스 정산)이 **데이터베이스 수준에서 철저하게 설계**되어 있습니다. 복식부기 원장, 멱등성 보장, RLS 보안 등 **파이낸셜 시스템의 필수 요소를 잘 갖추고 있습니다.**

가장 시급한 개선 사항은 **`user-web`의 3,233행 단일 컴포넌트를 적절히 분리**하는 것입니다. 6개 탭을 각각 독립 컴포넌트로 추출하고, 공통 UI 패턴(버튼, 카드, 모달 등)을 재사용 가능한 컴포넌트로 만들면 유지보수성이 크게 향상될 것입니다.

---

*이 문서는 프로젝트 전반적인 구조와 품질을 파악하기 위해 자동으로 생성되었습니다.*
