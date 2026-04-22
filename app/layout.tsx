import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ChatFab from "./components/ChatFab";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JECRC 1st Sem & 3rd Sem Results — Complete Info Portal",
  description: "Check your B.Tech 1st & 3rd semester results, internal marks, and complete student info — JECRC Foundation.",
};

export const viewport: Viewport = {
  width: "device-width",
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
      <body
        className={`${jakarta.variable} antialiased font-sans overflow-x-hidden`}
      >
        {children}
        <ChatFab />
      </body>
    </html>
  );
}
