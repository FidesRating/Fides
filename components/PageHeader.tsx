import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  crumb: string;
  chip: string;
  title: ReactNode;
  sub: string;
  giant?: string;
}

export default function PageHeader({ crumb, chip, title, sub, giant }: Props) {
  return (
    <section className="box ph">
      <div className="l">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>{crumb}</span></nav>
        <span className="eyebrow chip">{chip}</span>
        <h1>{title}</h1>
      </div>
      <div className="r"><p className="sub">{sub}</p></div>
      {giant && <span className="giant" aria-hidden="true">{giant}</span>}
    </section>
  );
}
