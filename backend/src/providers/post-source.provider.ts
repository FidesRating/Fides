/** A public post as read from a platform. */
export interface PublicPost {
  url: string;
  platform: 'x' | 'youtube' | 'telegram';
  postedAt: Date;
  text: string;
  deleted: boolean;
}

/**
 * Adapter for reading public posts. The MVP has no implementation: analysts enter calls by hand and
 * record an archive link. An X API implementation is blocked on an open owner decision (X API tier).
 */
export interface PostSource {
  fetchPost(url: string): Promise<PublicPost | null>;
}
