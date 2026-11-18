"use client";

import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, LayoutDashboard, Users, BookOpen, UserPen, FileSpreadsheet } from "lucide-react";
import { PanelSidebar } from "@/components/panel-sidebar";

const NAV_ITEMS = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { title: "User Management", href: "/admin/users", icon: Users },
  { title: "Course Management", href: "/admin/courses", icon: BookOpen },
  { title: "Impor Akademik", href: "/admin/academic-import", icon: FileSpreadsheet },
  { title: "Prompt AI", href: "/admin/tutor-prompts", icon: UserPen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!session || (session.user as { role?: string }).role !== "admin") {
    return null;
  }

  return (
    <SidebarProvider>
      <PanelSidebar
        title="Admin Panel"
        href="/admin"
        label="Management Panel"
        navItems={NAV_ITEMS}
        defaultRoleName="Admin"
      />
      <SidebarInset>
        {/* Header atas hanya untuk mobile (menampilkan SidebarTrigger) */}
        <header className="flex h-14 shrink-0 items-center border-b px-6 md:hidden">
          <SidebarTrigger className="-ml-2" />
        </header>

        {/* Konten halaman */}
        <main className="flex-1 px-6 md:px-10 pb-10 pt-6 md:pt-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
