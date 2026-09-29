import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "WhatsApp OK", template: "%s | WhatsApp OK" },
  description: "Central segura de comunicacoes pelo WhatsApp",
  icons: { icon: "/api/branding/logo" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
