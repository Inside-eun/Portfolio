import { getSettings, listSlideData } from "@/lib/store";
import Viewer from "./Viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [slides, settings] = await Promise.all([listSlideData(), getSettings()]);
  return <Viewer slides={slides} settings={settings} />;
}
