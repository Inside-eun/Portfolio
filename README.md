# Portfolio

PDF/이미지를 업로드하면 한 장씩 넘겨보는 슬라이드 포트폴리오가 되고, 마지막 페이지에 연락처가 나오는 사이트입니다.

- 포트폴리오 `/` — ↑↓←→ 방향키, 스크롤(휠·트랙패드), 모바일 스와이프로 한 페이지씩 이동. Home/End로 처음/연락처.
- 관리자 `/admin` — PDF·이미지 업로드, 연락처 페이지 편집.

## 업로드

- **PDF**: 브라우저에서 페이지별 가로 3840px 무손실 이미지로 변환됩니다. PDF 안의 링크(웹 주소·메일·PDF 내부 페이지 이동)도 함께 저장되어 슬라이드 위에서 클릭할 수 있습니다.
- **이미지**(PNG/JPG/WebP): 선택한 순서대로 슬라이드가 됩니다.
- **Figma(.fig)**: Figma 전용 형식이라 웹에서 직접 열 수 없습니다. Figma에서 PDF 또는 PNG로 내보낸 뒤 업로드하세요.

## 저장소

| 환경 | 저장 위치 |
|---|---|
| Vercel (`BLOB_READ_WRITE_TOKEN` 있음) | Vercel Blob — 이미지는 브라우저에서 Blob으로 바로 업로드 |
| 로컬 (토큰 없음) | `./data` 폴더 (`PORTFOLIO_DATA_DIR`로 위치 변경 가능) |

## 로컬 실행

```bash
cp .env.example .env.local   # ADMIN_PASSWORD 수정
npm install
npm run dev                  # http://localhost:3000
```

## Vercel 배포

1. Vercel에서 **Add New → Project** → 이 GitHub 저장소를 Import (프레임워크는 Next.js로 자동 인식).
2. **Environment Variables**에 `ADMIN_PASSWORD` 추가 후 Deploy.
3. 프로젝트의 **Storage** 탭 → **Create → Blob** → 접근 방식 **Public**으로 생성하고 이 프로젝트에 연결.
   (연결하면 `BLOB_READ_WRITE_TOKEN`이 자동으로 추가됩니다.)
4. **Deployments**에서 최신 배포를 **Redeploy** (새 환경 변수 반영).
5. `https://<도메인>/admin`에 로그인해 PDF 업로드 · 연락처 저장.

이후 코드 변경은 `main` 브랜치에 push하면 자동으로 재배포됩니다.
