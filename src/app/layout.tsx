import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriCoach — Eat Smart, Level Up",
  description: "Track meals, complete challenges, collect cute characters, and build healthy eating habits — the fun way.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0c0f1a] text-[#e8eaf0] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
