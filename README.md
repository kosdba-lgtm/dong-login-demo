# Railway Login Demo

간단한 Express + PostgreSQL 로그인 데모입니다.

## 로컬 실행

1. 의존성 설치

```bash
npm install
```

2. 서버 실행

```bash
npm start
```

3. 브라우저에서 확인

`http://localhost:3000`

> 로컬에서 PostgreSQL을 사용하려면 `DATABASE_URL` 환경 변수를 설정해야 합니다.

### 로컬 `.env` 사용

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요.

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3001
```

그런 다음 `npm start`를 실행하면 `.env` 값이 자동으로 반영됩니다.

## Railway 배포 준비

1. Railway에 새 프로젝트 생성
2. `PostgreSQL` 플러그인 추가
3. Railway에서 생성된 `DATABASE_URL` 환경 변수를 확인
4. 프로젝트를 GitHub에 푸시
5. Railway에서 GitHub 리포지토리를 연결하고 배포

## Railway Postgres 테이블 생성

Railway의 SQL 콘솔이나 `psql`을 이용해 다음 SQL을 실행하세요.

```sql
CREATE TABLE users (
  id serial PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  name text NOT NULL
);

INSERT INTO users (email, password, name)
VALUES ('test@example.com', 'password123', 'Test User');
```

## 참조

- `app.js`: Express 서버
- `public/index.html`: 로그인/회원가입 UI
- `public/script.js`: 로그인/회원가입 API 호출
