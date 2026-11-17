'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getInvitationReturnPath } from '@/lib/invitation-return-path';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// ─── Schema ──────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Component ───────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsPending(true);
    setFormError(null);

    try {
      const result = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
        rememberMe: true,
      });

      if (result?.error) {
        setFormError(result.error.message || 'Invalid email or password.');
        return;
      }

      const userWithRole = result?.data?.user as { role?: string } | undefined;
      const roleRedirectMap: Record<string, string> = {
        admin: '/admin',
        dosen: '/dosen',
        mahasiswa: '/mahasiswa',
      };
      const redirectTo = roleRedirectMap[userWithRole?.role ?? ''] ?? '/dashboard';
      const returnTo = getInvitationReturnPath(new URLSearchParams(window.location.search).get('returnTo'));
      router.push(returnTo ?? redirectTo);
    } catch {
      setFormError('An error occurred during login. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
            className={cn(
              'h-10 rounded-lg border-muted-foreground/20 pl-10 pr-3.5 text-sm placeholder:text-[13px] transition-all focus:border-brand focus:ring-1 focus:ring-brand shadow-none',
              form.formState.errors.email &&
                'border-destructive focus-visible:ring-destructive/20',
            )}
            placeholder="name@mail.unpad.ac.id"
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-[11px] text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" title="Password" className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...form.register('password')}
            aria-invalid={!!form.formState.errors.password}
            className={cn(
              'h-10 rounded-lg border-muted-foreground/20 pl-10 pr-10 text-sm placeholder:text-[13px] transition-all focus:border-brand focus:ring-1 focus:ring-brand shadow-none',
              form.formState.errors.password &&
                'border-destructive focus-visible:ring-destructive/20',
            )}
            placeholder="Enter your password"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-transparent"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
        {form.formState.errors.password && (
          <p className="text-[11px] text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <p className="mt-[-10px] text-left text-[11px] text-muted-foreground leading-relaxed">
        Dengan login, Anda telah menyetujui seluruh kebijakan dan ketentuan layanan Tutor AI.
      </p>

      {/* Server Error */}
      {formError && (
        <div className="rounded-lg bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive text-center font-medium">{formError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-10 w-full rounded-lg bg-brand text-white text-sm font-bold transition-all hover:bg-brand/80 active:scale-[0.98] shadow-none mt-2"
      >
        {isPending ? (
          <Loader2 className="mr-2 animate-spin size-4" />
        ) : null}
        {isPending ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}
