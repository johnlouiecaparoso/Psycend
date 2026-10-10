"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

export function RegisterForm() {
  const [submitError, setSubmitError] = React.useState("");
  const [submitSuccess, setSubmitSuccess] = React.useState("");
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  async function onSubmit(values: RegisterInput) {
    try {
      setSubmitError("");
      setSubmitSuccess("");
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName
          }
        }
      });

      if (error) {
        throw error;
      }

      setSubmitSuccess("Student account created. Check your email for the confirmation link.");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create account.");
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Public sign-up creates a student account. Instructor and admin roles should be assigned by an existing admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName ? <p className="text-sm text-destructive">{errors.fullName.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input id="register-email" type="email" {...register("email")} />
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <Input id="register-password" type="password" {...register("password")} />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
            {errors.confirmPassword ? <p className="text-sm text-destructive">{errors.confirmPassword.message}</p> : null}
          </div>
          <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
            Default role: <span className="font-semibold">student</span>
          </div>
          <Button className="w-full" disabled={isSubmitting} type="submit">
            Create account
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="font-semibold text-primary">
              User Agreement
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-primary">
              Privacy Policy
            </Link>
            . You will be asked to confirm these the first time you sign in.
          </p>
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          {submitSuccess ? <p className="text-sm text-emerald-600">{submitSuccess}</p> : null}
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="font-semibold text-primary">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
