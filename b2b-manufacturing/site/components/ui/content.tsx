import { sizedImage, srcSetFor } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { LinkButton } from './Button';

export const Tag = ({ children }: { children: ReactNode }) => <span className="tag">{children}</span>;

/** "Sample content" marker (D6) for wording that is placeholder until the owner supplies the real text. */
export const SampleMarker = ({ label }: { label: string }) => <span className="tag" data-sample="true">{label}</span>;

export function CheckList({ items }: { items: string[] }) {
  return <ul className="chk">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export const Stat = ({ value, caption }: { value: string; caption: string }) => (
  <div className="stat"><b>{value}</b><span>{caption}</span></div>
);

export const CertChip = ({ title, caption }: { title: string; caption: string }) => <div>{title}<small>{caption}</small></div>;
export const CertRow = ({ children }: { children: ReactNode }) => <div className="cert">{children}</div>;

export const Testimonial = ({ quote, role, org }: { quote: string; role: string; org: string }) => (
  <figure className="quote" style={{ margin: 0 }}><blockquote style={{ margin: 0 }}><p>{quote}</p></blockquote><figcaption><cite><b>{role}</b>{org}</cite></figcaption></figure>
);

export const AudienceCard = ({ title, body }: { title: string; body: string }) => <div className="card"><div className="b"><h3>{title}</h3><p>{body}</p></div></div>;

export function ServiceCard({ href, index, name, summary, imageUrl, more }: { href: string; index?: number; name: string; summary: string; imageUrl?: string; more: string }) {
  return (
    <Link className="card" href={href}>
      {imageUrl ? (
        // Images are alt-text decorative (the name follows); plain img because the optimizer is off.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sizedImage(imageUrl, 800)} srcSet={srcSetFor(imageUrl, [400, 800])} sizes="(max-width: 900px) 100vw, 600px" alt="" loading="lazy" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
      ) : <div className="ph" aria-hidden="true" />}
      <div className="b">
        {index ? <span className="num">{String(index).padStart(2, '0')}</span> : null}
        <h3>{name}</h3>
        <p>{summary}</p>
        <span className="more">{more}</span>
      </div>
    </Link>
  );
}

export function PageHeader({ breadcrumb, title, lead }: { breadcrumb: { homeLabel: string; current: string }; title: string; lead?: string }) {
  return (
    <div className="phead"><div className="wrap">
      <nav aria-label={breadcrumb.current} className="crumb"><Link href="/">{breadcrumb.homeLabel}</Link> / <span aria-current="page">{breadcrumb.current}</span></nav>
      <h1>{title}</h1>
      {lead ? <p>{lead}</p> : null}
    </div></div>
  );
}

export function CtaBand({ title, cta, href }: { title: string; cta: string; href: string }) {
  return <div className="cta"><div className="wrap"><h2>{title}</h2><LinkButton variant="white" href={href}>{cta}</LinkButton></div></div>;
}

export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="steps" aria-label={label} style={{ listStyle: 'none', padding: 0 }}>
      {steps.map((step, index) => (
        <li key={step} className={index === current ? 'on' : index < current ? 'done' : ''} aria-current={index === current ? 'step' : undefined}>
          <i aria-hidden="true">{index < current ? '✓' : index + 1}</i>{step}
        </li>
      ))}
    </ol>
  );
}

export function OptionCard({ name, value, checked, onChange, title, body, type = 'radio' }: { name: string; value: string; checked: boolean; onChange: (value: string, checked: boolean) => void; title: string; body?: string; type?: 'radio' | 'checkbox' }) {
  return (
    <label className={`opt${checked ? ' on' : ''}`}>
      <input type={type} name={name} value={value} checked={checked} onChange={(event) => onChange(value, event.target.checked)} />
      <span><b>{title}</b>{body ? <small>{body}</small> : null}</span>
    </label>
  );
}
