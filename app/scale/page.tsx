import type { Metadata } from 'next';
import ScalePage from '@/components/pages/ScalePage';

export const metadata: Metadata = {
  title: 'Scale',
  description: 'Twenty-one letter grades plus D and NR, with outlook and rating watch.',
};

export default function Page() {
  return <div className="page-stack"><ScalePage /></div>;
}
