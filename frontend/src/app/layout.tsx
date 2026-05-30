import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Harness Trading - AI 交易助手',
  description: '以安全信任为核心的 AI Agent 股票交易助手',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
