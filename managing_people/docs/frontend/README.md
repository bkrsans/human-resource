# Frontend Documentation

상태: 기준

프론트엔드 문서는 사용자에게 보이는 동작, 클라이언트 상태 전이, 접근성 및 서버·저장소 경계를 정의한다.

## 문서 목록

- [아키텍처](architecture.md)
- [인재 풀](people-directory.md)
- [역량 시각화](competency-visualization.md)
- [네트워크 맵](network-graph.md)
- [데이터 스튜디오](data-studio.md)
- [다중 네트워크 관리](graph-management.md)
- [계정 및 프로필](authentication-profile.md)
- [UI 및 접근성](ui-accessibility.md)

## 공통 구현 규칙

- 현재 사용자 식별 전에는 사용자별 데이터를 불러오거나 변경하지 않는다.
- 외부 입력과 서버 응답은 검증 후 상태에 반영한다.
- 로딩, 성공, 빈 결과, 오류 상태를 구분해 사용자에게 알린다.
- 주요 작업은 키보드로 수행 가능해야 하며 포커스 이동이 예측 가능해야 한다.
- 화면 크기에 따라 표현은 달라질 수 있지만 기능을 제거하지 않는다.
