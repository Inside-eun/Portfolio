import { resolveIcon } from "@/lib/icons";

// 24×24 stroke icons, drawn in currentColor.
const ICON_PATHS = {
  phone: (
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  blog: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  github: (
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] ?? ICON_PATHS.link}
    </svg>
  );
}

// The closing page: cover-style header and footer rules around a single
// centred column — name, title, then an icon + pill pair for every contact.
export default function Contact({ settings }) {
  const { name, year, title, contacts } = settings;
  const visible = contacts.filter((c) => c.value);

  return (
    <div className="contact">
      <header className="contact-head">
        <span>CONTACT</span>
        <span>{year}</span>
      </header>

      <div className="contact-inner">
        <p className="contact-name">{name}</p>
        <h1 className="contact-title">{title}</h1>

        <ul className="contact-list">
          {visible.map((c, i) => {
            const external = /^https?:/i.test(c.url);
            return (
              <li key={i}>
                <span className="contact-icon">
                  <Icon name={resolveIcon(c.icon, c.url)} />
                </span>
                {c.url ? (
                  <a
                    className="contact-pill"
                    href={c.url}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {c.value}
                  </a>
                ) : (
                  <span className="contact-pill">{c.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="contact-foot">
        <span>
          © {year} {name}
        </span>
      </footer>
    </div>
  );
}
