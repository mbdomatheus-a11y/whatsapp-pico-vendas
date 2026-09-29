import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AdminManager } from "@/components/admin-manager";

export default async function AdminPage() {
  const auth = await requireUser();
  if (!["master", "admin"].includes(auth.access.profile.role)) redirect("/dashboard");
  return <AdminManager isMaster={auth.access.profile.role === "master"} />;
}
