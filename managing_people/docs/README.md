# Documentation Harness

이 디렉터리는 `AGENTS.md`의 불변 원칙을 구현 가능한 명세와 검증 항목으로 연결한다. 충돌이 생기면 `AGENTS.md`, 공유 계약, 영역별 기능 명세 순으로 우선한다.

## 문서 지도

| 영역 | 목적 | 진입점 |
| --- | --- | --- |
| 입문 안내 | 전체 문서의 쉬운 요약과 사용 순서 | [초보자를 위한 전체 안내서](BEGINNER_GUIDE.md) |
| 제품 | 목표, 범위, 기능 요구사항 | [제품 요구사항](product/requirements.md) |
| 프론트엔드 | 사용자 흐름, UI 상태, 클라이언트 동작 | [프론트엔드 문서](frontend/README.md) |
| 백엔드 | 서버 경계, API, AI 추출, 오류 처리 | [백엔드 문서](backend/README.md) |
| 공유 계약 | 데이터 모델, 데이터 흐름, 입출력, 보안 | [데이터 모델](shared/data-model.md) |
| 품질 | 완료 여부를 판단하는 검증 목록 | [인수 체크리스트](quality/acceptance-checklist.md) |
| 결정 기록 | 중요한 기술 결정과 근거 | [ADR 안내](decisions/README.md) |
| 템플릿 | 새 명세와 결정 기록의 기본 형식 | [기능 명세](templates/feature-spec.md) |

## 권장 읽기 순서

1. 프로젝트가 처음이라면 `BEGINNER_GUIDE.md`에서 전체 구조와 용어를 익힌다.
2. 루트의 `AGENTS.md`에서 제품의 불변 원칙을 확인한다.
3. `product/requirements.md`에서 작업 범위와 사용자 가치를 확인한다.
4. 작업 영역의 `frontend/README.md` 또는 `backend/README.md`에서 관련 명세를 찾는다.
5. `shared/`의 데이터·보안 계약을 확인한다.
6. 구현 전후에 `quality/acceptance-checklist.md`를 점검한다.

## 갱신 규칙

- 기능 동작이 바뀌면 해당 기능 명세와 인수 체크리스트를 같은 변경에서 갱신한다.
- 데이터 필드나 의미가 바뀌면 `shared/data-model.md`, 입출력 계약, API 문서를 함께 검토한다.
- 인증, 저장 또는 외부 전송이 바뀌면 `shared/security-data-protection.md`를 반드시 검토한다.
- 장기간 영향을 주는 기술 선택은 ADR로 기록한다.
- 버전, 포트, 호스트, 공급자 모델명과 같은 실행 환경 값은 명세에 고정하지 않는다.
- 아직 결정되지 않은 내용은 사실처럼 쓰지 않고 `미결정`으로 표시하거나 ADR에서 결정한다.

## 문서 상태

각 명세는 다음 상태 중 하나를 문서 상단에 표시한다.

- `기준`: 구현이 따라야 하는 승인된 계약
- `초안`: 검토 중이며 구현 기준으로 확정되지 않음
- `폐기`: 더 이상 사용하지 않으며 대체 문서를 링크함
