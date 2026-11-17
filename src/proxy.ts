import { getInvitationReturnPath } from "@/lib/invitation-return-path";
import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_REDIRECT_MAP: Record<string, string> = {
    admin: "/admin",
    dosen: "/dosen",
    mahasiswa: "/mahasiswa",
};

function getUserRole(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
    return (session?.user as { role?: string } | undefined)?.role;
}

export default async function proxy(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    const { pathname } = request.nextUrl;
    const role = getUserRole(session);
    const isAuthPage = pathname.startsWith("/login");
    const isProtectedPage = pathname.startsWith("/dashboard") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/dosen") ||
        pathname.startsWith("/mahasiswa");

    // Unauthenticated users cannot access protected pages
    if (!session && isProtectedPage) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Authenticated users on login page → redirect by role
    if (session && isAuthPage) {
        const redirectTo = role ? ROLE_REDIRECT_MAP[role] ?? "/dashboard" : "/dashboard";
        return NextResponse.redirect(new URL(getInvitationReturnPath(request.nextUrl.searchParams.get("returnTo")) ?? redirectTo, request.url));
    }

    // Role-based protection for /admin
    if (session && pathname.startsWith("/admin") && role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Role-based protection for /dosen
    if (session && pathname.startsWith("/dosen") && role !== "dosen") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Role-based protection for /mahasiswa
    if (session && pathname.startsWith("/mahasiswa") && role !== "mahasiswa") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/admin/:path*", "/dosen/:path*", "/mahasiswa/:path*", "/login"],
};
