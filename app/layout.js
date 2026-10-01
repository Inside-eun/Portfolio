import "./globals.css";
import { getSettings } from "@/lib/store";

export async function generateMetadata() {
  const s = await getSettings();
  return {
    title: `${s.name} — Portfolio ${s.year}`,
    description: `${s.name}의 포트폴리오`,
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
