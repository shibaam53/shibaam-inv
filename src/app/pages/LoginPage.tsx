import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

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
    <main className="grid min-h-svh place-items-center bg-secondary p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center sm:text-left">
          <div className="mb-3 flex items-center justify-center sm:justify-start">
            <img
              src="/logo.png"
              alt="Shibaam Enterprises"
              className="h-16 w-auto object-contain"
            />
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Inventory management for authorised staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>
            {(error || notice) && (
              <p className="text-sm text-destructive" role="alert">
                {error ?? notice}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
