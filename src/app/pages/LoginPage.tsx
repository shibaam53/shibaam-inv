import { useState, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/lib/auth";
import { useFormErrorVisibility } from "@/app/lib/useFormErrorVisibility";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, session, profile, loading, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useFormErrorVisibility({
    error: error ?? notice,
    formErrors: errors,
    containerRef: formRef,
  });

  const from =
    (location.state as { from?: string } | null)?.from ?? "/app/dashboard";
  if (!loading && session && profile) return <Navigate to={from} replace />;

  async function onSubmit(values: FormValues) {
    setError(null);
    const message = await signIn(values.email, values.password);
    if (message) setError(message);
    else navigate(from, { replace: true });
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-secondary p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-hidden">
      {/* Subtle architectural engineering grid matching system theme */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#dde3ec_1px,transparent_1px),linear-gradient(to_bottom,#dde3ec_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_60%,transparent_100%)] opacity-50"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm sm:max-w-md space-y-4">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="space-y-4 pb-4">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <img
                src="/logo-icon.png"
                alt="Shibaam Enterprises"
                className="h-11 w-11 shrink-0 rounded-xl object-contain shadow-2xs border border-border/50 p-0.5 bg-white"
              />
              <div className="flex flex-col text-left">
                <span className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  <span className="text-brand-red">SHIBAAM</span>{" "}
                  <span className="text-brand-blue">ENTERPRISES</span>
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Stock &amp; Inventory Management
                </span>
              </div>
            </div>

            {/* Header Titles */}
            <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Sign in
                </CardTitle>
                <span className="rounded-full bg-brand-blue/10 px-2.5 py-0.5 text-[10px] font-semibold text-brand-blue border border-brand-blue/20">
                  Staff Portal
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Enter your authorized credentials to access inventory.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <form
              ref={formRef}
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-4"
              noValidate
            >
              {/* Email Input */}
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@shibaam.com"
                    autoComplete="username"
                    aria-invalid={!!errors.email}
                    className="h-11 pl-10 text-base sm:text-sm bg-background border-input focus-visible:ring-brand-blue"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-0.5" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Password Input with Visibility Toggle */}
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    className="h-11 pl-10 pr-11 text-base sm:text-sm bg-background border-input focus-visible:ring-brand-blue"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-0.5" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.password.message}</span>
                  </p>
                )}
              </div>

              {/* Global Error / Notice Banner */}
              {(error || notice) && (
                <div
                  className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs sm:text-sm text-destructive flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error ?? notice}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full text-sm font-semibold bg-brand-blue hover:bg-blue-700 active:scale-[0.99] text-white transition-all shadow-sm cursor-pointer mt-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security & System Info Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium text-center">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Secure 256-bit encrypted authentication</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/40">·</span>
          <span>Shibaam Enterprises v1.0</span>
        </div>
      </div>
    </main>
  );
}
