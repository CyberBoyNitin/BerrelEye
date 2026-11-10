import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "BerrelEye — Mission Control for AI Spend",
    template: "%s · BerrelEye",
  },
  description:
    "Point your OpenAI-compatible traffic at BerrelEye. We track real costs, route to cheaper models, and prove every dollar saved.",
  openGraph: {
    title: "BerrelEye — Mission Control for AI Spend",
    description:
      "Track real LLM costs, route to cheaper models, and prove every dollar saved.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          {children}
          <Toaster
            position="bottom-right"
            gap={8}
            toastOptions={{
              style: {
                background: "var(--be-overlay)",
                color: "var(--be-ink-1)",
                border: "1px solid var(--be-line-1)",
                borderRadius: "12px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
