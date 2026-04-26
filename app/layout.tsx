import type { Metadata, Viewport } from 'next';
import { Manrope, Sora } from 'next/font/google';
import './globals.css';
import ChatFab from './components/ChatFab';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JECRC Live Chat and Results Portal',
  description: 'Main website chat, request handling, and the separated JECRC results portal experience.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable} overflow-x-hidden font-sans antialiased`}>
        {children}
        <ChatFab />
      </body>
    </html>
  );
}
