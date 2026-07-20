# ⛓️ [핵심 비즈니스] 369 후원 롤업(Pass-up) 로직 및 PWA 웹앱 아키텍처 명세
> **독창적인 3의 배수 후원계보 롤업 알고리즘 및 PWA 모바일 웹앱 구현 가이드라인**

본 문서는 플랫폼의 가장 핵심적인 비즈니스 로직인 **369 후원 롤업(Pass-up) 계보도 정산 규칙**을 완벽하게 파악하여 모델링하고, React Native 앱 대신 **Next.js 기반 PWA(Progressive Web App) 모바일 웹앱**으로 아키텍처를 전면 전환하기 위한 개발 지침을 정의합니다.

---

## 1. 369 후원 롤업 (Pass-up) 알고리즘 정의

우리 시스템은 **추천계보도(Direct Tree)**와 **후원계보도(Placement Tree)**가 분리되어 동작하는 하이브리드 네트워크 마케팅 구조를 갖습니다.

*   **추천계보도 (Direct Tree)**: 내가 직접 추천한 모든 회원은 나의 **1대(Direct Downline)**로만 배치됩니다. (추천 수당 20% 정산의 기준)
*   **후원계보도 (Placement Tree)**: 추천인이 직접 추천한 순서 중 **3의 배수(3, 6, 9, 12...) 번째 가입자**는 상위 스폰서의 후원계보도로 롤업(Roll-up)되어 배치됩니다. (육성/임마/최탄/직급 수당 정산의 기준)

### 🔄 롤업 스폰서 라인 시뮬레이션
*   **스폰서 체인**: `A (스폰서) ➡️ B (스폰서) ➡️ C (나)`
*   **C(나)의 직접 추천 순서**: `1, 2, 3, 4, 5, 6, 7, 8, 9...`

```text
[추천계보도 (Direct Tree)]
         C (나)
  ┌───┬───┼───┬───┬───┐
  1   2   3   4   5   6 ... (모든 직접 추천인은 1대에 배치)

[후원계보도 (Placement Tree)]
       B (내 스폰서)              C (나)
          │                      ┌───┴───┐
      [3], [6] (롤업 안착)       1       2
                                 ┌───┴───┐
                             [1-3] (롤업 안착)
```

#### 📌 롤업 규칙 세부 분석 (Cascading Roll-up)
1. **나의 3배수 추천인 처리**:
   * 내가 추천한 `3`, `6`, `9` 번째 회원들의 **추천인**은 여전히 **C(나)** 이지만, **후원인**은 나의 스폰서인 **B**의 하위 후원계보도로 롤업되어 부착됩니다.
2. **하위 회원의 3배수 추천인 처리 (연쇄 패스업)**:
   * 내가 추천한 `1`번 회원이 하위로 `1-1, 1-2, 1-3` 회원을 추천하는 경우:
     * `1-3`은 `1`번의 **3번째 추천인**이므로, `1`번의 추천인인 **C(나)**의 후원계보도로 롤업되어 부착됩니다.
     * 이 규칙에 의해, 직접 추천인이 아니더라도 하위 조직에서 발생한 3배수 인원들이 상위 스폰서의 후원 구조로 연쇄적으로 패스업(Pass-up)되어 올라오게 됩니다.

---

## 2. 데이터베이스 스키마 설계 및 관계 매핑

이 로직을 처리하기 위해 데이터베이스의 `users` 테이블 구조를 확장하고, 추천인(`parent_id`)과 별개로 후원인(`sponsor_id` 또는 `placement_parent_id`)을 추적해야 합니다.

### 2.1 테이블 정의 (PostgreSQL DDL)
```sql
-- users 테이블 확장
CREATE TABLE public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nickname TEXT,
    parent_id UUID REFERENCES public.users(id),       -- 추천인 (Direct Sponsor, 추천계보도 기준)
    placement_id UUID REFERENCES public.users(id),    -- 후원인 (Placement Parent, 후원계보도 기준)
    referral_count INT DEFAULT 0 NOT NULL,            -- 해당 유저가 "직접 추천"한 총 인원수 (3배수 판단용)
    status TEXT DEFAULT 'PENDING' NOT NULL,           -- PENDING (미결제), ACTIVE (결제완료/조직도 배치)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_user_status CHECK (status IN ('PENDING', 'ACTIVE'))
);
```

### 2.2 조직도 배치 트리거 (Active Trigger Function)
회원이 상품을 결제하여 `status`가 `PENDING ➡️ ACTIVE`로 변경될 때, 추천인의 누적 추천 수(`referral_count`)를 1 증가시키고, 이것이 3의 배수인지 판별하여 후원인(`placement_id`)을 결정하는 배치 훅(Hook)을 실행합니다.

```sql
CREATE OR REPLACE FUNCTION public.handle_user_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_referral_count INT;
    v_grandparent_id UUID;
BEGIN
    -- status가 ACTIVE로 변경될 때만 실행
    IF NEW.status = 'ACTIVE' AND OLD.status = 'PENDING' THEN
        -- 1. 추천인(parent_id)이 존재할 경우 처리
        IF NEW.parent_id IS NOT NULL THEN
            -- 추천인의 누적 추천수 1 증가 (락을 획득하여 동시성 제어)
            UPDATE public.users 
            SET referral_count = referral_count + 1 
            WHERE id = NEW.parent_id
            RETURNING referral_count INTO v_parent_referral_count;

            -- 2. 3의 배수 번째 추천인인지 확인
            IF v_parent_referral_count % 3 = 0 THEN
                -- 3의 배수일 경우: 추천인의 후원인(placement_id)의 하위로 롤업 배치
                SELECT placement_id INTO v_grandparent_id FROM public.users WHERE id = NEW.parent_id;
                NEW.placement_id := v_grandparent_id;
            ELSE
                -- 3의 배수가 아닐 경우: 일반 추천인의 하위 후원으로 배치
                NEW.placement_id := NEW.parent_id;
            END IF;
        ELSE
            -- 스폰서가 없는 최상위 루트 노드인 경우
            NEW.placement_id := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_activation
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_activation();
```

---

## 3. PWA (Progressive Web App) 모바일 웹앱 아키텍처

기존 React Native 하이브리드 앱 모델을 폐기하고, 브라우저 환경에서 네이티브 앱처럼 동작하는 **PWA 모바일 웹앱**으로 빌드 방향을 전환합니다.

```mermaid
graph TD
    User([모바일 사용자 브라우저]) -->|홈 화면에 추가| PWA[PWA 바탕화면 바로가기 아이콘]
    PWA -->|App Shell 구동| SW[Service Worker / Cache]
    SW -->|UI 렌더링| UI[Next.js Client WebApp]
    UI -->|하단 탭 바| TabBar[홈 | 지갑 | 게임 | 조직 | 설정]
```

### 3.1 PWA 핵심 요구사항 명세
1. **바탕화면 아이콘 추가 (Add to Home Screen)**:
   * `public/manifest.json` 파일 구성 (아이콘 파일 명시, `display: "standalone"`, `orientation: "portrait"` 설정).
   * iOS 지원을 위한 `<meta name="apple-mobile-web-app-capable" content="yes">` 설정.
2. **하단 탭 바 UI 네비게이션**:
   * 모바일 화면 크기에 100% 최적화된 고정형 하단 탭 바 컴포넌트 구현.
   * **탭 5개**: 홈(Dashboard) | 지갑(Wallet/Deposit/Withdraw) | 게임(369 추첨) | 조직(Network Tree) | 설정(Preferences/Bio).
3. **조직 탭 이원화**:
   * **추천계보도 탭**: 단순 1대 직속 하위 멤버들을 리스트/그리드 형태로 정렬 노출.
   * **후원계보도 탭**: 369 롤업 규칙이 반영되어 실제 후원인(`placement_id`) 관계로 부착된 트리 구조(추천 스폰서에게 패스업된 내역 표시 포함)를 SVG 다이어그램 형태로 시각화하여 노출.
