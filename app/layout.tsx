import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "미리봄 | 나를 위한 쉬운 검사 준비 안내",
  description: "병원 안내문과 나의 답변을 바탕으로 쉬운 말과 그림으로 맞춤형 검사 준비 안내를 만듭니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={GeistMono.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
