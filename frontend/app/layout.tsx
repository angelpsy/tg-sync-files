import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { SocketProvider } from '@/shared/lib/providers/SocketProvider';
import { Footer } from '@/widgets/footer/Footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Telegram FileSync',
  description: 'Sync files to Telegram channels',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        <SocketProvider>
          <main className="min-h-screen bg-background text-foreground">
            <div className="container mx-auto px-4 py-8">{children}</div>
          </main>
          <Footer />
        </SocketProvider>
      </body>
    </html>
  );
}
