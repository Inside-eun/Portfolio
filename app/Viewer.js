"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Contact from "./Contact";

const GESTURE_GAP_MS = 150; // wheel silence that marks the start of a new gesture
const MIN_STEP_MS = 300; // floor between wheel-triggered steps
const WHEEL_TRIGGER_PX = 8; // scroll distance within a gesture that turns the page
const SWIPE_THRESHOLD = 50;

export default function Viewer({ slides, settings }) {
  // Pages = every slide + the contact page at the end.
  const total = slides.length + 1;
  const [index, setIndex] = useState(0);
  const wheel = useRef({ lastEvent: 0, lastStep: 0, lastAbs: 0, sum: 0, fired: false });
  const touchStart = useRef(null);
  const contactRef = useRef(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  // On short screens the contact page scrolls internally; only leave it
  // (going back) once that inner scroll is at the top.
  const contactConsumes = (dir) => {
    const el = contactRef.current;
    if (indexRef.current !== total - 1 || !el || el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 || el.scrollTop > 0;
  };

  const go = useCallback((next) => setIndex(Math.max(0, Math.min(total - 1, next))), [total]);
  const step = useCallback(
    (dir) => setIndex((cur) => Math.max(0, Math.min(total - 1, cur + dir))),
    [total]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        step(1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(total - 1);
      }
    };

    // One wheel gesture = one page. Deltas are summed within a gesture and the
    // page turns as soon as the sum passes a small threshold, so even a gentle
    // scroll counts. Once fired, the rest of the gesture (including trackpad
    // inertia) is ignored. A gesture starts after a short silence, or when the
    // delta suddenly grows again (a fresh swipe on top of decaying inertia).
    const onWheel = (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (contactConsumes(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      // Normalise line/page deltas (Firefox) to pixels.
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      const abs = Math.abs(dy);
      const w = wheel.current;

      const silence = now - w.lastEvent > GESTURE_GAP_MS;
      const freshSwipe = w.fired && abs > w.lastAbs * 1.5 && abs > 15 && now - w.lastStep > MIN_STEP_MS;
      const reversed = w.sum !== 0 && Math.sign(dy) !== Math.sign(w.sum) && !w.fired;
      if (silence || freshSwipe || reversed) {
        w.sum = 0;
        w.fired = false;
      }
      w.lastEvent = now;
      w.lastAbs = abs;
      if (w.fired) return;

      w.sum += dy;
      if (Math.abs(w.sum) >= WHEEL_TRIGGER_PX) {
        w.fired = true;
        w.lastStep = now;
        step(w.sum > 0 ? 1 : -1);
      }
    };

    const onTouchStart = (e) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
      const delta = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      if (Math.abs(dy) > Math.abs(dx) && contactConsumes(-dy)) return;
      step(delta < 0 ? 1 : -1);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [step, go, total]);

  const isContact = index === total - 1;
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <main className="viewer">
      <div className="track" style={{ transform: `translate3d(0, ${-index * 100}%, 0)` }}>
        {slides.map(({ src, links }, i) => (
          <section className="page slide-page" key={src} aria-hidden={index !== i}>
            {/* The frame shrink-wraps the image so link regions (fractions of
                the slide) line up with it at any screen size. */}
            <div className="slide-frame">
              {/* Load the current slide and its neighbours first; the rest lazily. */}
              <img
                src={src}
                alt={`포트폴리오 ${i + 1}페이지`}
                loading={Math.abs(i - index) <= 2 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
              {links.map((l, j) => {
                const style = {
                  left: `${l.x * 100}%`,
                  top: `${l.y * 100}%`,
                  width: `${l.w * 100}%`,
                  height: `${l.h * 100}%`,
                };
                const tabIndex = index === i ? 0 : -1;
                return l.url ? (
                  <a
                    key={j}
                    className="slide-link"
                    style={style}
                    href={l.url}
                    title={l.url}
                    tabIndex={tabIndex}
                    {...(/^https?:/i.test(l.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  />
                ) : (
                  <button
                    key={j}
                    className="slide-link"
                    style={style}
                    aria-label={`${l.page + 1}페이지로 이동`}
                    tabIndex={tabIndex}
                    onClick={() => go(l.page)}
                  />
                );
              })}
            </div>
          </section>
        ))}
        <section className="page contact-page" ref={contactRef} aria-hidden={!isContact}>
          <Contact settings={settings} />
        </section>
      </div>

      {total > 1 && (
        <>
          <nav className="dots" aria-label="페이지 이동">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                className={i === index ? "dot active" : "dot"}
                aria-label={i === total - 1 ? "연락처" : `${i + 1}페이지`}
                aria-current={i === index ? "page" : undefined}
                onClick={() => go(i)}
              />
            ))}
          </nav>
          <div className={isContact ? "counter hidden" : "counter"}>
            <span className="counter-now">{pad(index + 1)}</span>
            <span className="counter-sep" />
            <span>{pad(total - 1)}</span>
          </div>
          {!isContact && (
            <button className="contact-jump" onClick={() => go(total - 1)}>
              Contact
            </button>
          )}
        </>
      )}
    </main>
  );
}
