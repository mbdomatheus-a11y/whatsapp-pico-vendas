import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Pico de Vendas",
  description: "Operacao semiautomatica de mensagens por gestor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
