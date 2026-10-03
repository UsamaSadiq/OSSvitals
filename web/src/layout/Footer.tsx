import { useSiteMeta, type FooterMeta } from "./siteMeta";

interface FooterLink {
  label: string;
  url: string;
}

export function footerLinks(footer: FooterMeta): FooterLink[] {
  const candidates = [
    { label: "Source code", url: footer.sourceUrl },
    { label: "Privacy", url: footer.privacyUrl },
  ];
  return candidates.filter((link): link is FooterLink => Boolean(link.url));
}

export function Footer() {
  const { footer } = useSiteMeta();
  const links = footerLinks(footer);

  return (
    <footer className="footer">
      {links.length > 0 && (
        <p className="footer__links">
          {links.map((link, index) => (
            <span key={link.label}>
              {index > 0 && " · "}
              <a href={link.url} rel="noopener noreferrer">
                {link.label}
              </a>
            </span>
          ))}
        </p>
      )}
      {footer.notice && <p className="footer__notice">{footer.notice}</p>}
    </footer>
  );
}
