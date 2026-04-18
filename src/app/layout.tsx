import type { Metadata } from "next";
import { Press_Start_2P, Silkscreen, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  variable: "--font-press",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-silk",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const pixelify = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meal Quest — A field guide for eating well in real life",
  description: "Ambient nutrition coach for every lifestyle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${silkscreen.variable} ${pixelify.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
