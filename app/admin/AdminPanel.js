"use client";

import { useRef, useState } from "react";
import { ICON_LABELS } from "@/lib/icons";

const TARGET_WIDTH = 3840; // px width each PDF page is rendered at (4K / Retina sharp)
const BATCH = 2; // slides per upload request in local mode (lossless images are larger)

// Resolves a PDF link destination (named or explicit) to a 0-based page index.
async function destToPageIndex(pdf, dest) {
  const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
  if (!Array.isArray(explicit)) return null;
  const target = explicit[0];
  if (Number.isInteger(target)) return target;
  try {
    return await pdf.getPageIndex(target);
  } catch {
    return null;
  }
}

// Link annotations on a page, as fractions of the page box.
async function extractLinks(pdf, page, viewport) {
  const links = [];
  for (const a of await page.getAnnotations({ intent: "display" })) {
    if (a.subtype !== "Link") continue;
    const [x1, y1] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
    const [x2, y2] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
    const box = {
      x: Math.min(x1, x2) / viewport.width,
      y: Math.min(y1, y2) / viewport.height,
      w: Math.abs(x2 - x1) / viewport.width,
      h: Math.abs(y2 - y1) / viewport.height,
    };
    const url = a.url || a.unsafeUrl;
    if (url) {
      links.push({ ...box, url });
    } else if (a.dest) {
      const page = await destToPageIndex(pdf, a.dest);
      if (page !== null) links.push({ ...box, page });
    }
  }
  return links;
}

// Renders every page of a PDF to a lossless image in the browser with pdf.js,
// keeping its links. Internal links hold the page index within this PDF.
async function pdfToSlides(file, onProgress) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pdf = await task.promise;
  const slides = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress(n, pdf.numPages);
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(6, TARGET_WIDTH / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    // WebP at quality 1 is lossless in Chrome; Safari falls back to PNG (also lossless).
    const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 1));
    slides.push({ blob, links: await extractLinks(pdf, page, viewport) });
    page.cleanup();
    canvas.width = canvas.height = 0; // release the large canvas promptly
  }
  await task.destroy();
  return slides;
}

const EXT = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/avif": "avif" };

// Vercel: each image goes straight from the browser to Blob storage, then the
// ordered list (with links) is committed in one request.
async function uploadToBlob(items, mode, say, setSlides, presigned) {
  const { upload, uploadPresigned } = await import("@vercel/blob/client");
  const send = presigned ? uploadPresigned : upload; // OIDC-connected stores use presigned URLs
  const batchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const uploaded = [];
  for (let i = 0; i < items.length; i++) {
    say(`업로드 중… (${i + 1}/${items.length})`);
    const { blob, links } = items[i];
    const pathname = `slides/${batchId}-${String(i + 1).padStart(3, "0")}.${EXT[blob.type] ?? "png"}`;
    const { url } = await send(pathname, blob, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      contentType: blob.type,
    });
    uploaded.push({ src: url, links });
  }
  say("저장 중…");
  const res = await fetch("/api/slides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, slides: uploaded }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `저장 실패 (${res.status})`);
  setSlides(json.slides);
}

// Local: images are posted to the app server in small batches.
async function uploadToServer(items, mode, say, setSlides) {
  for (let i = 0; i < items.length; i += BATCH) {
    say(`업로드 중… (${Math.min(i + BATCH, items.length)}/${items.length})`);
    const form = new FormData();
    form.set("mode", i === 0 ? mode : "append");
    for (const item of items.slice(i, i + BATCH)) {
      form.append("files", item.blob);
      form.append("links", JSON.stringify(item.links));
    }
    const res = await fetch("/api/slides", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `업로드 실패 (${res.status})`);
    setSlides(json.slides);
  }
}

export default function AdminPanel({ initialSlides, initialSettings, storage, presigned }) {
  const [slides, setSlides] = useState(initialSlides);
  const [settings, setSettings] = useState(initialSettings);
  const [mode, setMode] = useState("replace");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", error: false });
  const [savedMsg, setSavedMsg] = useState("");
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const say = (text, error = false) => setStatus({ text, error });

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length || busy) return;

    if (files.some((f) => /\.fig$/i.test(f.name))) {
      say(
        ".fig 파일은 Figma 전용 형식이라 웹에서 바로 열 수 없습니다. Figma에서 [파일 → 프레임을 PDF로 내보내기] 하거나 프레임을 PNG로 내보낸 뒤 업로드해 주세요.",
        true
      );
      return;
    }

    setBusy(true);
    try {
      // Collect slides in order: each PDF expands into its pages. Internal PDF
      // links are re-based onto the final slide index.
      const base = mode === "replace" ? 0 : slides.length;
      const items = [];
      for (const f of files) {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          const start = base + items.length;
          const pages = await pdfToSlides(f, (n, total) => say(`PDF 변환 중… ${f.name} (${n}/${total})`));
          for (const p of pages) {
            items.push({
              blob: p.blob,
              links: p.links.map((l) => ("page" in l ? { ...l, page: start + l.page } : l)),
            });
          }
        } else if (f.type.startsWith("image/")) {
          items.push({ blob: f, links: [] });
        } else {
          throw new Error(`지원하지 않는 파일입니다: ${f.name}`);
        }
      }

      if (storage === "blob") await uploadToBlob(items, mode, say, setSlides, presigned);
      else await uploadToServer(items, mode, say, setSlides);
      const linkCount = items.reduce((n, it) => n + it.links.length, 0);
      say(
        `완료! ${items.length}장의 슬라이드를 ${mode === "replace" ? "새로 올렸습니다" : "추가했습니다"}` +
          (linkCount ? ` (링크 ${linkCount}개 포함).` : ".")
      );
    } catch (e) {
      say(e.message || "처리 중 오류가 발생했습니다", true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteAll() {
    if (!confirm("업로드된 슬라이드를 모두 삭제할까요?")) return;
    const res = await fetch("/api/slides", { method: "DELETE" });
    if (res.ok) {
      setSlides([]);
      say("모든 슬라이드를 삭제했습니다.");
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavedMsg("저장 중…");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSettings(await res.json());
      setSavedMsg("저장되었습니다.");
    } else {
      setSavedMsg("저장에 실패했습니다.");
    }
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.reload();
  }

  const set = (key) => (e) => setSettings({ ...settings, [key]: e.target.value });
  const setContact = (i, key) => (e) => {
    const contacts = settings.contacts.map((c, j) => (j === i ? { ...c, [key]: e.target.value } : c));
    setSettings({ ...settings, contacts });
  };
  const moveContact = (i, dir) => {
    const contacts = [...settings.contacts];
    const j = i + dir;
    if (j < 0 || j >= contacts.length) return;
    [contacts[i], contacts[j]] = [contacts[j], contacts[i]];
    setSettings({ ...settings, contacts });
  };

  return (
    <div className="admin">
      <header className="sheet-head">
        <span>PORTFOLIO · ADMIN</span>
        <span className="row">
          <a className="btn" href="/" target="_blank" rel="noreferrer">
            사이트 보기
          </a>
          <button className="btn" onClick={logout}>
            로그아웃
          </button>
        </span>
      </header>

      <main className="admin-main">
        <section>
          <h2>포트폴리오 업로드</h2>
          <p className="sub">
            PDF는 페이지마다 한 장의 슬라이드로 변환됩니다. 이미지(PNG·JPG·WebP)는 선택한 순서대로 올라갑니다.
            <br />
            Figma(.fig) 파일은 Figma에서 PDF 또는 PNG로 내보낸 뒤 올려주세요.
          </p>

          {storage === "missing" ? (
            <div className="notice">
              <strong>Vercel Blob 저장소가 연결되지 않아 업로드·저장을 할 수 없습니다.</strong>
              <ol>
                <li>Vercel 프로젝트 → Storage 탭 → Create → Blob (접근 방식 Public) → 이 프로젝트에 연결</li>
                <li>Settings → Environment Variables에 BLOB_STORE_ID(또는 BLOB_READ_WRITE_TOKEN)가 생겼는지 확인</li>
                <li>Deployments → 최신 배포 → Redeploy</li>
              </ol>
            </div>
          ) : (
            <p className="storage-badge">
              저장 위치: {storage === "blob" ? "Vercel Blob" : "로컬 data 폴더"}
            </p>
          )}

          <div
            className={over ? "drop over" : "drop"}
            onClick={() => !busy && storage !== "missing" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (storage !== "missing") handleFiles(e.dataTransfer.files);
            }}
          >
            {busy ? (
              "처리 중입니다…"
            ) : (
              <>
                파일을 여기로 끌어오거나 <strong>클릭해서 선택</strong>하세요
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.fig"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
            <div className="row" role="radiogroup">
              <label className="row" style={{ gap: 6, fontSize: 14 }}>
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                기존 슬라이드 교체
              </label>
              <label className="row" style={{ gap: 6, fontSize: 14, marginLeft: 12 }}>
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
                뒤에 추가
              </label>
            </div>
            <button className="btn danger" onClick={deleteAll} disabled={busy || !slides.length}>
              전체 삭제
            </button>
          </div>
          <p className={status.error ? "status error" : "status"}>{status.text}</p>

          {slides.length > 0 ? (
            <div className="thumbs">
              {slides.map((s, i) => (
                <figure key={s.src}>
                  <img src={s.src} alt="" loading="lazy" />
                  {String(i + 1).padStart(2, "0")}
                  {s.links.length > 0 && ` · 링크 ${s.links.length}개`}
                </figure>
              ))}
            </div>
          ) : (
            <p className="sub">아직 업로드된 슬라이드가 없습니다.</p>
          )}
        </section>

        <section>
          <h2>연락처 페이지</h2>
          <p className="sub">포트폴리오 마지막 페이지에 세로로 표시됩니다. 아이콘을 “자동”으로 두면 링크 주소를 보고 알맞은 아이콘을 고릅니다.</p>

          <form className="stack" onSubmit={saveSettings}>
            <div className="grid-2">
              <label className="field">
                이름
                <input value={settings.name} onChange={set("name")} />
              </label>
              <label className="field">
                연도
                <input value={settings.year} onChange={set("year")} />
              </label>
            </div>
            <label className="field">
              제목
              <input value={settings.title} onChange={set("title")} />
            </label>

            {settings.contacts.map((c, i) => (
              <div className="contact-card" key={i}>
                <div className="contact-card-head">
                  <span>연락처 {i + 1}</span>
                  <span className="row">
                    <button type="button" className="btn" onClick={() => moveContact(i, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => moveContact(i, 1)}
                      disabled={i === settings.contacts.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() =>
                        setSettings({ ...settings, contacts: settings.contacts.filter((_, j) => j !== i) })
                      }
                    >
                      삭제
                    </button>
                  </span>
                </div>
                <div className="grid-2">
                  <label className="field">
                    아이콘
                    <select value={c.icon} onChange={setContact(i, "icon")}>
                      {Object.entries(ICON_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    표시 텍스트
                    <input value={c.value} onChange={setContact(i, "value")} />
                  </label>
                </div>
                <label className="field">
                  링크
                  <input value={c.url} placeholder="https://velog.io/@me · mailto:me@mail.com · tel:01012345678" onChange={setContact(i, "url")} />
                </label>
              </div>
            ))}

            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSettings({
                    ...settings,
                    contacts: [...settings.contacts, { icon: "auto", value: "", url: "" }],
                  })
                }
              >
                + 연락처 추가
              </button>
              <span className="row">
                <span className="status">{savedMsg}</span>
                <button className="btn primary">저장</button>
              </span>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
