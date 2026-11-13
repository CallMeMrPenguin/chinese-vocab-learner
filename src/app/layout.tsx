import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Học Từ Vựng Tiếng Trung - Chinese Vocab Learner',
  description: 'Ứng dụng học từ vựng tiếng Trung dựa trên cơ sở khoa học và ưu thế âm Hán Việt cho người Việt.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#eef2f6] text-slate-800 selection:bg-blue-100 selection:text-blue-900">
        <main>{children}</main>
      </body>
    </html>
  );
}
