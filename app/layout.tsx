import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미리봄 | 나를 위한 쉬운 검사 준비 안내",
  description: "병원 안내문을 분석하고 내 답변을 반영해 큰 글씨와 그림으로 된 맞춤형 Easy Read 안내서를 만듭니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
