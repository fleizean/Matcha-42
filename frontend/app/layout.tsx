"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollToTop from "@/components/ScrollToTop";
import AuthCheck from "@/components/AuthCheck";
import { Inter } from "next/font/google";
import "node_modules/react-modal-video/css/modal-video.css";
import "../styles/index.css";
import { SessionProvider, useSession } from "next-auth/react";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

// Footer will always be shown regardless of user login status
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body className={`bg-[#FCFCFC] dark:bg-black ${inter.className}`}>
        <SessionProvider>
          <Providers>
            <AuthCheck />
            <Header />
            {children}
            <Footer />
            <ScrollToTop />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}