import type { Metadata } from "next";
import { Prompt, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "thai"],
});

// Latin-only display face for the sidebar masthead/issue numbers ONLY — never
// for anything that can carry real (often Thai) content, which stays in Prompt.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

// Kept as --font-geist-mono (the token globals.css already reads) even though
// the font itself is now JetBrains Mono — matches the mockup's data/figures
// face without touching the @theme mapping.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IntrovertHubs",
  description: "Context-aware task readiness for small teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${prompt.variable} ${jetBrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
