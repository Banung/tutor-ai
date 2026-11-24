"use client";

import { authClient } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, LayoutDashboard, BookOpen, Compass, UserRound } from "lucide-react";
import { PanelSidebar } from "@/components/panel-sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/mahasiswa", icon: LayoutDashboard, exact: true },
  { title: "My Courses", href: "/mahasiswa/courses", icon: BookOpen },
  { title: "Katalog Course", href: "/mahasiswa/catalog", icon: Compass },
  { title: "Profile", href: "/mahasiswa/profile", icon: UserRound },
];

export default function MahasiswaLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();

  if (isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!session || (session.user as { role?: string }).role !== "mahasiswa") {
    return null;
  }

  const isTutorChatRoute = /^\/mahasiswa\/courses\/[^/]+\/tutor(?:\/|$)/.test(pathname);

  if (isTutorChatRoute) {
    return children;
  }

  return (
    <SidebarProvider>
      <PanelSidebar
        title="Mahasiswa Panel"
        href="/mahasiswa"
        label="Pembelajaran"
        navItems={NAV_ITEMS}
        defaultRoleName="Mahasiswa"
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b px-6 md:hidden">
          <SidebarTrigger className="-ml-2" />
        </header>
        <main className="flex-1 px-6 pb-10 pt-6 md:px-10 md:pt-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
