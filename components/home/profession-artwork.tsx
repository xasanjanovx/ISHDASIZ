import { Briefcase, TerminalSquare, GraduationCap, HeartPulse, Building2, Wheat, Factory, ShoppingBag, Truck, ChartNoAxesCombined, Wrench } from 'lucide-react';
import type { CSSProperties } from 'react';
import styles from './home-sections.module.css';

const professions = {
  Monitor: { Icon: TerminalSquare, tint: '#dfe6f1', ink: '#36506d', mark: '</>' },
  Factory: { Icon: Factory, tint: '#e5e2d8', ink: '#645b45', mark: '⚙' },
  Wrench: { Icon: Wrench, tint: '#ecddcf', ink: '#83593b', mark: '✦' },
  GraduationCap: { Icon: GraduationCap, tint: '#e9e2c9', ink: '#756138', mark: 'Aa' },
  Heart: { Icon: HeartPulse, tint: '#dce8df', ink: '#396352', mark: '+' },
  Wallet: { Icon: ChartNoAxesCombined, tint: '#e3e6d4', ink: '#59633e', mark: '↗' },
  Building2: { Icon: Building2, tint: '#efdec4', ink: '#8d6338', mark: '⊞' },
  Wheat: { Icon: Wheat, tint: '#e4e8ce', ink: '#63733c', mark: '✳' },
  Truck: { Icon: Truck, tint: '#dfe6e9', ink: '#456473', mark: '→' },
  ShoppingBag: { Icon: ShoppingBag, tint: '#eeddcf', ink: '#835a46', mark: '✧' },
  Briefcase: { Icon: Briefcase, tint: '#e6dfd3', ink: '#665943', mark: '↗' },
};
export function ProfessionArtwork({ kind, small = false }: { kind?: string; small?: boolean }) {
  const { Icon, tint, ink, mark } = professions[kind as keyof typeof professions] || professions.Briefcase;
  return <span className={`${styles.artwork} ${small ? styles.artworkSmall : ''}`} style={{ '--art-tint': tint, '--art-ink': ink } as CSSProperties} aria-hidden="true">
    <span className={styles.artPlate}><Icon strokeWidth={1.5} /></span><span className={styles.artDetail}>{mark}</span>
  </span>;
}
