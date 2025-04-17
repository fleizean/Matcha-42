"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollToTop from "@/components/ScrollToTop";
import AuthCheck from "@/components/AuthCheck";
import { Inter } from "next/font/google";
import "node_modules/react-modal-video/css/modal-video.css";
import "../styles/index.css";
import { SessionProvider } from "next-auth/react";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      {/* ✅ Flex düzen ve min-h-screen eklendi */}
      <body className={`flex min-h-screen flex-col bg-[#FCFCFC] dark:bg-black ${inter.className}`}>
        <SessionProvider>
          <Providers>
            <AuthCheck />
            <Header />
            {/* ✅ İçeriği saran main'e flex-1 verildi */}
            <main className="flex-1">{children}</main>
            <Footer />
            <ScrollToTop />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
