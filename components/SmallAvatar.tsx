import { safeAvatarUrl } from '@/lib/format';

/** A small round profile picture for lists. The initial letter stays underneath as the fallback. */
export default function SmallAvatar({ handle, url }: { handle: string; url: string | null }) {
  const src = safeAvatarUrl(url);
  return (
    <span className="av-sm" aria-hidden="true">
      {handle[0].toUpperCase()}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={36} height={36} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      )}
    </span>
  );
}
