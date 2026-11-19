import type { Metadata } from 'next';
import { getLatestReport } from '@/lib/api';
import ScalePage from '@/components/pages/ScalePage';

export const metadata: Metadata = {
  title: 'Scale',
  description: 'Twenty-one letter grades plus D and NR, with outlook and rating watch.',
};

export default async function Page() {
  const report = await getLatestReport();
  return <div className="page-stack"><ScalePage report={report} /></div>;
}
