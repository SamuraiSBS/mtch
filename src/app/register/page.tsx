import { AuthForm } from "@/components/auth-form";
type RegisterPageProps = {
  searchParams: Promise<{ role?: string | string[] }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { role } = await searchParams;
  return <AuthForm mode="register" initialRole={role === "EMPLOYER" ? "EMPLOYER" : "SPECIALIST"} />;
}
