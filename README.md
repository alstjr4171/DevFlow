# DevFlow

개인 개발자를 위한 TODO + GitHub 대시보드입니다.

## 실행 방법

1. Node.js LTS를 설치합니다.
2. 이 폴더에서 터미널을 엽니다.
3. 아래 명령어를 순서대로 실행합니다.

```bash
npm install
npm run dev
```

4. 터미널에 표시되는 주소(보통 http://localhost:5173)를 브라우저에서 엽니다.

## 주요 기능

- Dashboard: 작업 통계, 오늘의 TODO, 프로젝트 요약, GitHub 최근 활동
- TODO: 작업 추가, 완료 처리, 삭제, 검색, 상태 필터
- GitHub: 공개 프로필, 공개 Repository, 최근 공개 이벤트 조회
- Projects: 프로젝트 추가 및 삭제, 진행률 관리
- Settings: GitHub 사용자명 설정

## 데이터 및 제한

TODO, 프로젝트, GitHub 사용자명은 브라우저 LocalStorage에 저장됩니다.
GitHub 정보는 GitHub 공개 REST API에서 가져옵니다. 비공개 저장소를 조회하려면 별도의 인증 구현이 필요합니다.
LocalStorage 데이터는 브라우저/기기별로 분리되므로 다른 컴퓨터와 자동 동기화되지 않습니다.

## 기술 스택

- React
- Vite
- Lucide React
- CSS
- GitHub REST API
