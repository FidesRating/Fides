import type { Metadata } from 'next';
import EthicsPage from '@/components/pages/EthicsPage';

export const metadata: Metadata = {
  title: 'Ethics',
  description: 'Who can be rated, which data is used, right of reply, and takedown.',
};

export default function Page() {
  return <div className="page-stack"><EthicsPage /></div>;
}
