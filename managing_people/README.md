# Project Combination Engine

인재 프로필, 네 가지 핵심 역량, 관계망을 사용자별 로컬 공간에서 관리하는 React + Node.js 애플리케이션입니다. 파일 입력과 AI 결과는 전체 검증 후 사용자가 승인해야만 저장됩니다.

## 실행

```bash
pnpm install
pnpm dev
```

터미널에 표시된 주소를 브라우저에서 엽니다. 로그인 화면의 데모 워크스페이스에는 예시 인재와 관계가 준비되어 있습니다.

## 검증과 운영 빌드

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

AI 분석을 사용하려면 `.env.example`을 참고해 서버 환경에 API 키, 모델, 선택적 호환 API 주소를 설정합니다. 비밀 값은 `VITE_` 접두사나 클라이언트 코드에 넣지 않습니다. 설정하지 않아도 나머지 기능은 정상 동작하며 분석 요청만 안전한 설정 오류를 반환합니다.

상세 제품 계약과 인수 기준은 [`docs/README.md`](docs/README.md)에서 확인할 수 있습니다.
