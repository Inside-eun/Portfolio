import { isAdmin } from "@/lib/auth";
import { USE_BLOB, getSettings, listSlideData } from "@/lib/store";
import AdminPanel from "./AdminPanel";
import Login from "./Login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Portfolio", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <Login />;
  const [slides, settings] = await Promise.all([listSlideData(), getSettings()]);
  return <AdminPanel initialSlides={slides} initialSettings={settings} storage={USE_BLOB ? "blob" : "local"} />;
}
