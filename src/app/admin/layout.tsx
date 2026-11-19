/** Server-only admin layout — checks the Clerk-backed application role. */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "../../lib/auth";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminTopbar from "../../components/admin/AdminTopbar";
import "./admin.css";

export const metadata = {
  title: "Studio admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const theme = (await cookies()).get("ad_theme")?.value === "dark" ? "dark" : "light";

  return (
    <div className="ad-frame" data-theme={theme}>
      <AdminSidebar user={session.user} />
      <div className="ad-main">
        <AdminTopbar theme={theme} />
        {children}
      </div>
    </div>
  );
}
