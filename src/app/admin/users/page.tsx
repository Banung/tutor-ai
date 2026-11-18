"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  X,
  Lock,
  Unlock,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { parsePartialProvisioning } from "@/lib/user-provisioning";

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as { error?: unknown; issues?: unknown };
  if (typeof record.error === "string") return record.error;
  const candidates = Array.isArray(record.issues)
    ? record.issues
    : Array.isArray(record.error)
      ? record.error
      : null;
  if (!candidates) return fallback;
  const messages = candidates
    .map((issue) =>
      issue && typeof issue === "object" && "message" in issue
        ? String((issue as { message: unknown }).message)
        : String(issue)
    )
    .filter(Boolean);
  return messages.length > 0 ? [...new Set(messages)].join("; ") : fallback;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  academicLevel: string | null;
  npm: string | null;
  nip: string | null;
  nidn: string | null;
  major: string | null;
  faculty: string | null;
  bio: string | null;
  isActive: boolean;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  _count?: { sessions: number };
  createdAt: string;
}

interface SecurityLog {
  id: string;
  action: string;
  reason: string | null;
  revokedSessions: number;
  createdAt: string;
}

type SecurityAction = "freeze" | "unfreeze" | "force_logout";

const FREEZE_REASON_REQUIRED_MESSAGE = "Alasan pembekuan wajib diisi.";
const FREEZE_REASON_MAX_LENGTH_MESSAGE =
  "Alasan pembekuan maksimal 200 karakter.";
const REASON_MAX_LENGTH_MESSAGE = "Alasan maksimal 200 karakter.";

const SECURITY_ACTION_LABELS: Record<SecurityAction, string> = {
  freeze: "Pembekuan Akun",
  unfreeze: "Buka Pembekuan",
  force_logout: "Force Logout",
};

function UserFormFields({
  form,
  setForm,
  isCreate,
  lockRole,
}: {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  isCreate: boolean;
  lockRole: boolean;
}) {
  const isMahasiswa = form.role === "mahasiswa";
  const isDosen = form.role === "dosen";

  return (
    <div className="grid gap-5 py-2">
      <div className="grid gap-2">
        <Label htmlFor="name">Nama</Label>
        <Input
          id="name"
          value={form.name || ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nama lengkap"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={form.email || ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="email@mail.unpad.ac.id"
        />
      </div>
      {isCreate && (
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Minimal 6 karakter"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={form.role || "mahasiswa"}
          disabled={lockRole}
          onValueChange={(v) => {
            const updates: Record<string, string> = { ...form, role: v };
            if (v !== "mahasiswa") {
              updates.npm = "";
              updates.academicLevel = "";
            }
            if (v !== "dosen") {
              updates.nip = "";
              updates.nidn = "";
            }
            setForm(updates);
          }}
        >
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="dosen">Dosen</SelectItem>
              <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {lockRole && (
          <p className="text-xs text-muted-foreground">
            Peran akun sendiri tidak dapat diubah.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="isActive">Status Akun</Label>
        <Select
          value={form.isActive ?? "true"}
          disabled={lockRole}
          onValueChange={(v) => setForm({ ...form, isActive: v })}
        >
          <SelectTrigger id="isActive">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="true">Aktif</SelectItem>
              <SelectItem value="false">Nonaktif</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {lockRole && (
          <p className="text-xs text-muted-foreground">
            Status akun sendiri tidak dapat diubah.
          </p>
        )}
      </div>
      {isMahasiswa && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="npm">NPM</Label>
            <Input
              id="npm"
              inputMode="numeric"
              value={form.npm || ""}
              onChange={(e) => setForm({ ...form, npm: e.target.value })}
              placeholder="8–18 digit angka"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="academicLevel">Jenjang</Label>
            <Select
              value={form.academicLevel || ""}
              onValueChange={(v) => setForm({ ...form, academicLevel: v })}
            >
              <SelectTrigger id="academicLevel">
                <SelectValue placeholder="Pilih jenjang" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="S1">S1</SelectItem>
                  <SelectItem value="S2">S2</SelectItem>
                  <SelectItem value="S3">S3</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {isDosen && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="nip">
              NIP <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
            </Label>
            <Input
              id="nip"
              inputMode="numeric"
              value={form.nip || ""}
              onChange={(e) => setForm({ ...form, nip: e.target.value })}
              placeholder="8–18 digit angka"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nidn">
              NIDN <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
            </Label>
            <Input
              id="nidn"
              inputMode="numeric"
              value={form.nidn || ""}
              onChange={(e) => setForm({ ...form, nidn: e.target.value })}
              placeholder="8–18 digit angka"
            />
          </div>
        </>
      )}
      <div className="grid gap-2">
        <Label htmlFor="major">
          Jurusan <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
        </Label>
        <Input
          id="major"
          value={form.major || ""}
          onChange={(e) => setForm({ ...form, major: e.target.value })}
          placeholder="Contoh: Teknik Informatika"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="faculty">
          Fakultas <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
        </Label>
        <Input
          id="faculty"
          value={form.faculty || ""}
          onChange={(e) => setForm({ ...form, faculty: e.target.value })}
          placeholder="Contoh: FTIP"
        />
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Security action dialogs (freeze / unfreeze / force logout)
  const [securityDialog, setSecurityDialog] = useState<{
    user: User;
    action: SecurityAction;
  } | null>(null);
  const [securityReason, setSecurityReason] = useState("");
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySubmitting, setSecuritySubmitting] = useState(false);

  // Security audit log dialog
  const [logsUser, setLogsUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<SecurityLog[] | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (levelFilter !== "all") params.set("academicLevel", levelFilter);
    if (statusFilter === "active") params.set("isActive", "true");
    if (statusFilter === "inactive") params.set("isActive", "false");
    if (statusFilter === "frozen") params.set("isFrozen", "true");
    if (search) params.set("search", search);

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roleFilter, levelFilter, statusFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreate() {
    setEditingUser(null);
    setPartialNotice(null);
    setForm({ role: "mahasiswa", isActive: "true" });
    setDialogOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setPartialNotice(null);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      npm: user.npm || "",
      nip: user.nip || "",
      nidn: user.nidn || "",
      academicLevel: user.academicLevel || "",
      major: user.major || "",
      faculty: user.faculty || "",
      isActive: String(user.isActive ?? true),
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        ...form,
        isActive: form.isActive !== "false",
      };
      // Clean empty strings to null for optional fields
      for (const key of ["npm", "nip", "nidn", "academicLevel", "major", "faculty", "bio"]) {
        if (body[key] === "") body[key] = null;
      }

      if (editingUser) {
        // Password is create-only; a partial-provisioning recovery keeps it in
        // form state but must not send it to the strict PATCH schema.
        delete body.password;
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(errorMessage(data, "Gagal update"));
        setPartialNotice(null);
        toast.success("User berhasil diperbarui");
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          const partial = parsePartialProvisioning(data);
          if (partial) {
            // The account exists. Switch the open dialog to edit mode for that
            // saved user instead of offering another signup.
            setEditingUser({
              id: partial.userId,
              name: form.name || "",
              email: form.email || "",
              role: form.role || "mahasiswa",
              academicLevel: form.academicLevel || null,
              npm: form.npm || null,
              nip: form.nip || null,
              nidn: form.nidn || null,
              major: form.major || null,
              faculty: form.faculty || null,
              bio: form.bio || null,
              isActive: form.isActive !== "false",
              isFrozen: false,
              frozenAt: null,
              frozenReason: null,
              createdAt: "",
            });
            setPartialNotice(
              [partial.message, ...partial.issues].filter(Boolean).join(" ")
            );
            fetchUsers();
            toast.warning("Akun dibuat, tetapi finalisasi gagal");
            return;
          }
          throw new Error(errorMessage(data, "Gagal membuat user"));
        }
        toast.success("User berhasil dibuat");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(errorMessage(data, "Gagal menghapus"));
      }
      toast.success("User berhasil dihapus");
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus user");
    } finally {
      setDeleting(false);
    }
  }

  function openSecurityDialog(user: User, action: SecurityAction) {
    setSecurityDialog({ user, action });
    setSecurityReason("");
    setSecurityError(null);
  }

  function closeSecurityDialog() {
    setSecurityDialog(null);
    setSecurityReason("");
    setSecurityError(null);
  }

  async function handleSecurityAction() {
    if (!securityDialog) return;
    const { user, action } = securityDialog;
    const reason = securityReason.trim();

    if (action === "freeze" && !reason) {
      setSecurityError(FREEZE_REASON_REQUIRED_MESSAGE);
      return;
    }
    if (reason.length > 200) {
      setSecurityError(
        action === "freeze"
          ? FREEZE_REASON_MAX_LENGTH_MESSAGE
          : REASON_MAX_LENGTH_MESSAGE
      );
      return;
    }

    setSecurityError(null);
    setSecuritySubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason && { reason }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(errorMessage(data, "Gagal memproses tindakan keamanan"));
      }
      const revoked =
        typeof data?.revokedSessions === "number" ? data.revokedSessions : 0;
      toast.success(
        action === "freeze"
          ? `Akun dibekukan. ${revoked} sesi diputus.`
          : action === "unfreeze"
            ? "Pembekuan akun dibuka."
            : `Force logout selesai. ${revoked} sesi diakhiri.`
      );
      closeSecurityDialog();
      fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses tindakan keamanan"
      );
    } finally {
      setSecuritySubmitting(false);
    }
  }

  function openSecurityLogs(user: User) {
    setLogsUser(user);
    setLogs(null);
    fetch(`/api/admin/users/${user.id}/security`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.logs)) setLogs(data.logs);
      })
      .catch(() => {
        setLogs([]);
        toast.error("Gagal memuat riwayat keamanan");
      });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Kelola semua pengguna sistem</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-brand text-black hover:bg-brand/90">
          <Plus data-icon="inline-start" />
          Tambah User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, email, NPM, NIP, atau NIDN..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
              }
            }}
            className="pl-9"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="flex-1 sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="dosen">Dosen</SelectItem>
                <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="flex-1 sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Jenjang</SelectItem>
                <SelectItem value="S1">S1</SelectItem>
                <SelectItem value="S2">S2</SelectItem>
                <SelectItem value="S3">S3</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
                <SelectItem value="frozen">Dibekukan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">NPM / NIP / NIDN</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Jurusan</TableHead>
              <TableHead className="w-[80px] text-right pr-6">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Tidak ada user ditemukan
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 font-mono text-xs">
                    {user.npm ?? user.nip ?? user.nidn ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] truncate" title={user.name}>
                    {user.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[150px] sm:max-w-[200px] truncate" title={user.email}>
                    {user.email}
                  </TableCell>
                  <TableCell className="capitalize font-medium">
                    {user.role}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={
                          user.isFrozen
                            ? "destructive"
                            : user.isActive
                              ? "default"
                              : "secondary"
                        }
                        title={
                          user.isFrozen ? user.frozenReason ?? undefined : undefined
                        }
                      >
                        {user.isFrozen
                          ? "Dibekukan"
                          : user.isActive
                            ? "Aktif"
                            : "Nonaktif"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {user._count?.sessions ?? 0} sesi aktif
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.academicLevel ?? "—"}</TableCell>
                  <TableCell>{user.major ?? "—"}</TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil data-icon="inline-start" />
                            Edit
                          </DropdownMenuItem>
                          {user.id !== currentUserId && (
                            <>
                              {user.isFrozen ? (
                                <DropdownMenuItem
                                  onClick={() => openSecurityDialog(user, "unfreeze")}
                                >
                                  <Unlock data-icon="inline-start" />
                                  Buka Pembekuan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => openSecurityDialog(user, "freeze")}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Lock data-icon="inline-start" />
                                  Bekukan Akun
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  openSecurityDialog(user, "force_logout")
                                }
                              >
                                <LogOut data-icon="inline-start" />
                                Force Logout
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => openSecurityLogs(user)}>
                            <ShieldAlert data-icon="inline-start" />
                            Riwayat Keamanan
                          </DropdownMenuItem>
                          {user.id !== currentUserId && (
                            <DropdownMenuItem
                              onClick={() => setDeleteUser(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 data-icon="inline-start" />
                              Hapus
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl">{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Ubah data pengguna di bawah ini." : "Isi data untuk membuat pengguna baru."}
            </DialogDescription>
          </DialogHeader>
          {partialNotice && (
            <div
              role="alert"
              className="border-b border-destructive/30 bg-destructive/10 px-6 py-3 text-sm text-destructive"
            >
              <p className="font-medium">
                Akun sudah tersimpan, tetapi finalisasi profil/peran gagal.
              </p>
              <p>{partialNotice}</p>
              <p className="text-xs">
                Perbaiki data pada formulir ini lalu simpan. Jangan membuat akun baru
                dengan email yang sama.
              </p>
            </div>
          )}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <UserFormFields
              form={form}
              setForm={setForm}
              isCreate={!editingUser}
              lockRole={!!editingUser && editingUser.id === currentUserId}
            />
          </div>
          <DialogFooter className="m-0 px-6 py-4 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-brand text-black hover:bg-brand/90"
            >
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {editingUser ? "Simpan" : "Buat User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteUser?.name}</strong>? Tindakan ini
              tidak dapat dibatalkan dan akan menghapus semua data terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Security Action Confirmation */}
      <Dialog
        open={!!securityDialog}
        onOpenChange={(open) => {
          if (!open) closeSecurityDialog();
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {securityDialog?.action === "freeze"
                ? "Bekukan Akun"
                : securityDialog?.action === "unfreeze"
                  ? "Buka Pembekuan"
                  : "Force Logout"}
            </DialogTitle>
            <DialogDescription>
              {securityDialog?.action === "freeze"
                ? `Membekukan akun ${securityDialog.user.name} akan memblokir login (BR-008) dan memutus seluruh sesi aktifnya segera. Akun tidak dapat masuk hingga pembekuan dibuka kembali oleh admin.`
                : securityDialog?.action === "unfreeze"
                  ? `Pembekuan akun ${securityDialog.user.name} akan dibuka sehingga pengguna dapat kembali masuk.`
                  : `Seluruh sesi aktif ${securityDialog?.user.name} akan diakhiri tanpa menghapus data pengguna (BR-009).`}
            </DialogDescription>
          </DialogHeader>

          {securityDialog?.action === "unfreeze" ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Alasan pembekuan: </span>
              {securityDialog?.user.frozenReason ?? "—"}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="security-reason">
                {securityDialog?.action === "freeze"
                  ? "Alasan Pembekuan"
                  : "Alasan (opsional)"}
              </Label>
              <Textarea
                id="security-reason"
                value={securityReason}
                onChange={(e) => {
                  setSecurityReason(e.target.value);
                  setSecurityError(null);
                }}
                placeholder={
                  securityDialog?.action === "freeze"
                    ? "Jelaskan alasan pembekuan akun..."
                    : "Catatan tindakan (opsional)..."
                }
                aria-invalid={!!securityError}
              />
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="text-destructive">{securityError}</span>
                <span className="shrink-0 text-muted-foreground">
                  {securityReason.length}/200
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeSecurityDialog}
              disabled={securitySubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSecurityAction}
              disabled={securitySubmitting}
              className={
                securityDialog?.action === "unfreeze"
                  ? "bg-brand text-black hover:bg-brand/90"
                  : "bg-destructive text-white hover:bg-destructive/90"
              }
            >
              {securitySubmitting && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
              {securityDialog?.action === "freeze"
                ? "Bekukan"
                : securityDialog?.action === "unfreeze"
                  ? "Buka Pembekuan"
                  : "Force Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Audit Log */}
      <Dialog open={!!logsUser} onOpenChange={(open) => !open && setLogsUser(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Riwayat Keamanan</DialogTitle>
            <DialogDescription>
              Catatan tindakan keamanan untuk {logsUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {logs === null ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada tindakan keamanan.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {logs.map((log) => (
                  <li key={log.id} className="flex flex-col gap-1 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {SECURITY_ACTION_LABELS[log.action as SecurityAction] ??
                          log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-muted-foreground">{log.reason}</p>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {log.revokedSessions} sesi diputus
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsUser(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
