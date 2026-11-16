import type { Metadata } from 'next';
import MethodologyPage from '@/components/pages/MethodologyPage';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Four pillars, automatic rules, the Rating Committee and surveillance, published in full.',
};

export default function Page() {
  return <div className="page-stack"><MethodologyPage /></div>;
}
