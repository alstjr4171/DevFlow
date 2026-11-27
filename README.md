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

## Supabase 및 GitHub 로그인 설정

로그인 기능과 계정별 데이터 저장을 사용하려면 다음 설정이 필요합니다.

1. Supabase에서 프로젝트를 만든 뒤 **Authentication → Providers → GitHub**에서 GitHub 로그인을 활성화합니다.
2. GitHub OAuth App의 callback URL에는 `https://<프로젝트-ref>.supabase.co/auth/v1/callback`을 입력합니다. GitHub OAuth App의 Client ID와 Client Secret은 Supabase의 GitHub provider 설정에 입력합니다.
3. Supabase의 **Authentication → URL Configuration**에서 Site URL을 `https://alstjr4171.github.io/DevFlow/`로 지정하고, Redirect URLs에도 같은 주소를 추가합니다.
4. Supabase **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다. 이 테이블은 RLS 정책으로 사용자 본인의 데이터만 읽고 수정하도록 제한합니다.
5. 프로젝트 루트의 `.env.example`을 `.env.local`로 복사해 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 입력합니다. 로컬 확인은 `npm run dev`로 할 수 있습니다.
6. 온라인 배포는 GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에 위 두 값을 같은 이름으로 등록하고 `main`에 push합니다. 공개 anon/publishable key만 사용하세요. `service_role` 키는 브라우저 앱이나 저장소에 넣지 마세요.

로그인한 GitHub 계정의 공개 프로필과 공개 저장소를 표시하고, TODO·프로젝트·GitHub 사용자명은 Supabase에 계정별로 저장합니다. GitHub 비공개 저장소 권한은 요청하지 않습니다.

## 주요 기능

- Dashboard: 작업 통계, 오늘의 TODO, 프로젝트 요약, GitHub 최근 활동
- TODO: 작업 추가, 완료 처리, 삭제, 검색, 상태 필터
- GitHub: 공개 프로필, 공개 Repository, 최근 공개 이벤트 조회
- Projects: 프로젝트 추가 및 삭제, 진행률 관리
- Settings: GitHub 사용자명 설정

## 데이터 및 제한

TODO, 프로젝트, GitHub 사용자명은 로그인한 계정에 연결해 Supabase 데이터베이스에 저장됩니다.
GitHub 로그인은 Supabase Auth를 통해 처리하고 공개 프로필과 공개 저장소는 GitHub REST API에서 조회합니다. 현재 비공개 저장소는 불러오지 않습니다.

## 기술 스택

- React
- Vite
- Lucide React
- CSS
- GitHub REST API
