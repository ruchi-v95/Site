# 오땡뭐! (오늘 점심 뭐먹지?)

검색창 하나와 버튼 몇 개로 지금 주변에서 먹을 곳 하나를 골라주는 모바일 우선 웹사이트입니다.

사이트: https://odaengmwo.com

## 구성

| 파일 | 역할 |
|---|---|
| `index.html`, `style.css`, `app.js` | 화면. 음식 종류(한식·중식·일식…)와 상황(점심·야식·국물…) 버튼으로 추천 |
| `api/places.js` | 카카오 로컬 API로 음식점 검색 (걸어서 1km, 차로 3km) (키는 서버에만 보관) |

서버 함수가 없거나 키가 없으면 화면은 **예시 데이터**로 동작하고, 카드에 "예시" 표시가 붙습니다.

## 무료 배포 (Vercel)

1. 이 폴더를 GitHub 저장소로 올립니다.
2. [vercel.com](https://vercel.com)에서 GitHub로 로그인 → **Add New Project** → 저장소 선택 → Deploy.
3. **Settings → Environment Variables**에 아래 값을 넣고 다시 배포합니다.

| 이름 | 어디서 받나 | 필수 |
|---|---|---|
| `KAKAO_REST_API_KEY` | [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 앱 키 → REST API 키. 앱 설정에서 **카카오맵(로컬) 사용 설정**을 켜야 합니다 | 예 |

## 비용

유료 서비스는 쓰지 않습니다. 카카오 로컬 API 무료 한도와 Vercel 무료 요금제 안에서 동작합니다.
- 직접 입력한 문장은 AI 없이 규칙으로 해석합니다. "중식", "국밥"처럼 아는 말은 그대로 쓰고, 모르는 말은 입력한 그대로 카카오에서 검색합니다.
- 카카오 검색 결과는 Vercel 캐시에 10분 보관해 같은 동네의 반복 호출을 줄입니다.
