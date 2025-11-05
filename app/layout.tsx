import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AppProviders } from "@/app/providers";
import "@/styles/admin-forms.css";

export const metadata: Metadata = {
  title: "School Management Portal",
  description: "Modernized frontend powered by Next.js",
  icons: {
    icon: "/assets/img/favicon.png",
  },
};

const legacyStylesheets = [
  "/assets/css/normalize.css",
  "/assets/css/bootstrap.min.css",
  "/assets/css/all.min.css",
  "/assets/fonts/flaticon.css",
  "/assets/css/animate.min.css",
  "/assets/css/main.css",
  "/assets/style.css",
] as const;

const legacyScriptSources = [
  "/assets/js/jquery-3.3.1.min.js",
  "/assets/js/plugins.js",
  "/assets/js/popper.min.js",
  "/assets/js/bootstrap.min.js",
  "/assets/js/jquery.scrollUp.min.js",
  "/assets/js/select2.min.js",
  "/assets/js/datepicker.min.js",
  "/assets/js/jquery.counterup.min.js",
  "/assets/js/moment.min.js",
  "/assets/js/jquery.waypoints.min.js",
  "/assets/js/fullcalendar.min.js",
  "/assets/js/Chart.min.js",
  "/assets/js/main.js",
] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {legacyStylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        {legacyScriptSources.map((src) => (
          <Script key={src} src={src} strategy="beforeInteractive" />
        ))}
      </body>
    </html>
  );
}
