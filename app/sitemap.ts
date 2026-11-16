import type { MetadataRoute } from 'next';
import { getRatings } from '@/lib/api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const PATHS = ['', '/ratings', '/under-review', '/actions', '/research', '/scale', '/methodology', '/ethics', '/claim', '/desk'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The API lists only published ratings of covered accounts, so taken-down accounts never appear here.
  const ratings = (await getRatings()) ?? [];
  return [
    ...PATHS.map((p) => ({ url: `${SITE}${p}` })),
    ...ratings.map((r) => ({ url: `${SITE}/ratings/${r.handle}`, lastModified: r.lastAction.publishedAt })),
  ];
}
