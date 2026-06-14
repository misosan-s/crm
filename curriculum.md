# 미소산랩 커리큘럼 (운영자 인터페이스)

Claude Code로 개발하며 마주치는 핵심 개념을 평일 매일 1개씩 배달합니다.
이 파일이 **원본**이고, `npm run ml:sync` 로 DB(`ml_curriculum`)에 동기화됩니다.

## 사용법

- 컬럼: `순서` · `개념명` · `연결 소스`
- `개념명`이 자연키입니다. 같은 개념명을 유지하면 재동기화해도 발송 상태가 보존됩니다.
- `연결 소스`는 콘텐츠 생성 시 참고할 GitHub 자료의 키워드(레포 URL 일부 또는 파일 경로 일부). 비워둬도 됩니다.
- 상태(`대기`/`발송완료`)는 DB가 관리하므로 이 파일에 적지 않습니다.
- 개념이 떨어지기 전에 이 표에 줄을 추가한 뒤 `npm run ml:sync` 를 실행하세요.

## 개념 목록

| 순서 | 개념명 | 연결 소스 |
|------|--------|-----------|
| 1 | 에이전트(Agent)란? | |
| 2 | 하네스(Harness)란? | |
| 3 | 툴 사용(Tool Use) | |
| 4 | 스킬(Skills) | |
| 5 | 슬래시 커맨드(Slash Commands) | |
| 6 | 서브에이전트(Subagents) | |
| 7 | MCP(Model Context Protocol) | |
| 8 | 훅(Hooks) | |
| 9 | 권한 모드(Permission Modes) | |
| 10 | 플랜 모드(Plan Mode) | |
| 11 | 메모리와 CLAUDE.md | |
| 12 | 컨텍스트 관리(Context Management) | |
| 13 | 컨텍스트 윈도우와 토큰 | |
| 14 | 모델 선택(Model Selection) | |
| 15 | 어댑티브 thinking | |
| 16 | 프롬프트 캐싱(Prompt Caching) | |
| 17 | 스트리밍(Streaming) | |
| 18 | 구조화된 출력(Structured Outputs) | |
| 19 | 배치 API(Batches) | |
| 20 | 세션과 상태 관리 | |
