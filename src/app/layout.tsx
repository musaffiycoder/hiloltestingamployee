import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Apple qurilmalarida system font (SF Pro) ishlatiladi; Inter — boshqa platformalar uchun zaxira.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Baholash", template: "%s · Baholash" },
  description: "Lavozim kartalari asosida xodim va nomzodlarni baholash platformasi",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F5EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C0D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,t=localStorage.getItem('baholash_theme'),s=localStorage.getItem('baholash_sidebar');if(t==='light'||t==='dark')d.dataset.theme=t;if(s==='collapsed')d.dataset.sidebar=s}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
