import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import defaultApi from "@/lib/api";
import { useAppData } from "@/state/useAppData";

export function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAppData();

  const { register, handleSubmit, formState: { errors } } = useForm<any>();

  async function onSubmit({ firstName, lastName, email, password, address }: any) {
    setIsLoading(true);
    try {
      const response = await defaultApi.register({ firstName, lastName, email, password, address }).then(res => res.data);
      localStorage.setItem("auth_token", response.accessToken);
      setUser(response.user);
      navigate("/");
      toast.success("Account created successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up for a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="firstName">First Name(s)</FieldLabel>
              <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
              <FieldError errors={errors.firstName ? [errors.firstName] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="lastName">Last Name(s)</FieldLabel>
              <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
              <FieldError errors={errors.lastName ? [errors.lastName] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" type="password" {...register("password")} aria-invalid={!!errors.password} />
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary underline hover:text-primary/80">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
