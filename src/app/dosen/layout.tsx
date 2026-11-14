"use client";

import { authClient } from "@/lib/auth-client";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, LayoutDashboard, BookOpen, MessageSquareWarning, FilePenLine } from "lucide-react";
import { PanelSidebar } from "@/components/panel-sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dosen", icon: LayoutDashboard, exact: true },
  { title: "My Courses", href: "/dosen/courses", icon: BookOpen },
  { title: "Feedback Jawaban", href: "/dosen/feedback", icon: MessageSquareWarning },
  { title: "Koreksi Jawaban", href: "/dosen/corrections", icon: FilePenLine },
];

export default function DosenLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!session || (session.user as { role?: string }).role !== "dosen") {
    return null;
  }

  return (
    <SidebarProvider>
      <PanelSidebar
        title="Dosen Panel"
        href="/dosen"
        label="Pengajaran"
        navItems={NAV_ITEMS}
        defaultRoleName="Dosen"
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b px-6 md:hidden">
          <SidebarTrigger className="-ml-2" />
        </header>
        <main className="flex-1 px-6 md:px-10 pb-10 pt-6 md:pt-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
