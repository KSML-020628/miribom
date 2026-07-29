# 미리봄

병원에서 받은 검사 안내문을 사진이나 PDF로 올리면, 문서 내용을 읽고 사용자에게 필요한 질문을 한 뒤 큰 글씨와 쉬운 문장으로 맞춤 안내서를 만드는 Next.js 애플리케이션입니다.

## 주요 흐름

1. 검사 안내문 사진 또는 PDF 업로드
2. Upstage Document Parse와 Information Extract로 문서 구조화
3. 안내문 근거가 확인된 맞춤 질문 표시
4. 사용자 답변에 맞는 준비사항만 선택
5. 큰 글씨·그림·음성으로 된 쉬운 안내서 생성
6. 안내문 근거 안에서 구어체·음성 질문에 쉬운 답변 제공
7. 인쇄 또는 PDF 저장

의료 진단이나 복약 결정을 하지 않으며, 약과 불명확한 내용은 병원에 확인하도록 안내합니다.

## 안내문 챗봇

- `물 돼?`, `약은?`, `몇 시부터?` 같은 짧은 구어체를 검수된 사전으로 정규화합니다.
- 모호한 질문은 추측하지 않고 사용자가 뜻을 더 분명하게 고르도록 안내합니다.
- 현재 맞춤 안내서와 병원 안내문에서 관련 근거를 먼저 찾은 뒤 Solar Pro 3가 쉬운 문장으로 답합니다.
- 근거가 없거나 증상·진단·복약 판단이 필요한 질문은 병원 확인으로 전환합니다.
- 대화와 원문은 현재 브라우저 세션에서만 사용하며 별도 DB나 `localStorage`에 저장하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

루트 폴더에 `.env.local`을 만들고 다음 값을 설정합니다.

```env
UPSTAGE_API_KEY=your-server-only-key
UPSTAGE_CHAT_MODEL=solar-pro3
```

`UPSTAGE_API_KEY`는 서버 API 라우트에서만 사용합니다. `NEXT_PUBLIC_` 접두사를 붙이거나 저장소에 실제 키를 올리지 마세요.

## Vercel 배포

1. Vercel에서 이 GitHub 저장소를 Import합니다.
2. Framework Preset은 `Next.js`, Root Directory는 저장소 루트로 둡니다.
3. Project Settings → Environment Variables에 다음 값을 추가합니다.
   - `UPSTAGE_API_KEY`: 실제 Upstage API 키
   - `UPSTAGE_CHAT_MODEL`: `solar-pro3`
4. Production, Preview, Development 중 필요한 환경 범위를 선택합니다.
5. 환경변수를 추가한 뒤 새로 배포합니다.

환경변수 값은 GitHub 저장소나 코드에 포함하지 않습니다.

## 명령어

```bash
npm run dev
npm run build
npm run start
```
