import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import styles from './home-sections.module.css';

export function SectionHeading({ kicker, title, description, href, action }: { kicker: string; title: string; description?: string; href?: string; action?: string }) {
  return <div className={styles.heading} data-home-reveal>
    <div><span className={styles.kicker}><i aria-hidden="true" />{kicker}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {href && <Link href={href} className={styles.textLink}>{action}<ArrowUpRight size={18} aria-hidden="true" /></Link>}
  </div>;
}
