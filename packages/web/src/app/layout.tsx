import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmDialogProvider } from "@/components/confirm/ConfirmDialogProvider";
import { CreateThreadDialogProvider } from "@/components/command/CreateThreadDialogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheTower Command",
  description: "Multi-agent communication kernel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
        <ConfirmDialogProvider />
        <CreateThreadDialogProvider />
      </body>
    </html>
  );
}
