import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import styles from './action-label.module.css';

export function ActionLabel({ children }: { children: ReactNode }) {
  return <span className={styles.action}><span className={styles.icon} aria-hidden="true"><i /><ArrowUpRight size={19} /></span><span className={styles.label}>{children}</span></span>;
}
