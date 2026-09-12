import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SyllaHub",
    template: "%s · SyllaHub",
  },
  description:
    "Upload a syllabus. Get a live timeline, grade tracker, and reminders for your whole semester.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SyllaHub",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border-line !shadow-lift !text-body",
            },
          }}
        />
      </body>
    </html>
  );
}
