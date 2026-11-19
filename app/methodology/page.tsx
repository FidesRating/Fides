import type { Metadata } from 'next';
import { getLatestReport } from '@/lib/api';
import MethodologyPage from '@/components/pages/MethodologyPage';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Four pillars, automatic rules, the Rating Committee and surveillance, published in full.',
};

export default async function Page() {
  const report = await getLatestReport();
  return <div className="page-stack"><MethodologyPage report={report} /></div>;
}
