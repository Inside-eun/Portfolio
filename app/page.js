import { getPdfUrl, getSettings, listSlideData } from "@/lib/store";
import Viewer from "./Viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [slides, settings, pdfUrl] = await Promise.all([listSlideData(), getSettings(), getPdfUrl()]);
  return <Viewer slides={slides} settings={settings} pdfUrl={pdfUrl} />;
}
