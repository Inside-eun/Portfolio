import { isAdmin } from "@/lib/auth";
import { BLOB_OIDC, STORAGE_MISSING, USE_BLOB, getPdfUrl, getSettings, listSlideData } from "@/lib/store";
import AdminPanel from "./AdminPanel";
import Login from "./Login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Portfolio", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <Login />;
  const [slides, settings, pdfUrl] = await Promise.all([listSlideData(), getSettings(), getPdfUrl()]);
  return (
    <AdminPanel
      initialSlides={slides}
      initialSettings={settings}
      initialPdf={pdfUrl}
      storage={STORAGE_MISSING ? "missing" : USE_BLOB ? "blob" : "local"}
      presigned={BLOB_OIDC}
    />
  );
}
