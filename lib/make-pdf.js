// Builds a PDF from the slide images in the visitor's browser, used when the
// admin hasn't saved an original PDF. Each page matches its slide's aspect ratio
// and keeps the slide's link regions clickable.

const MAX_WIDTH = 2400; // px; slides are stored at 4K, which would make a huge PDF
const PAGE_WIDTH = 960; // pt

async function loadJpeg(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`이미지를 불러오지 못했습니다 (${res.status})`);
  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.9);
  const ratio = canvas.height / canvas.width;
  canvas.width = canvas.height = 0;
  return { data, ratio };
}

export async function downloadSlidesPdf(slides, filename, onProgress) {
  const { jsPDF } = await import("jspdf");
  let doc;
  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const { data, ratio } = await loadJpeg(slides[i].src);
    const w = PAGE_WIDTH;
    const h = PAGE_WIDTH * ratio;
    const orientation = w >= h ? "landscape" : "portrait";
    if (!doc) doc = new jsPDF({ unit: "pt", format: [w, h], orientation, compress: true });
    else doc.addPage([w, h], orientation);
    doc.addImage(data, "JPEG", 0, 0, w, h);
    for (const l of slides[i].links) {
      const opts = l.url ? { url: l.url } : { pageNumber: l.page + 1 };
      if (!l.url && l.page >= slides.length) continue;
      doc.link(l.x * w, l.y * h, l.w * w, l.h * h, opts);
    }
  }
  doc.save(filename);
}
