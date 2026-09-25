/**
 * LinkedIn Posts API `commentary` uses the "little" text format.
 * Unescaped reserved characters (especially `(` / `)`) are treated as
 * mention/annotation markup and LinkedIn will drop the rest of the post
 * from the feed. Escape everything in the hook/body; leave the hashtag
 * line untouched so `#CloudComputing` still becomes a real hashtag.
 *
 * @see https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
 */
const LITTLE_RESERVED = /([\\|()[\]{}<>@#*])/g;

export function escapeLittleText(text: string): string {
  return text.replace(LITTLE_RESERVED, '\\$1');
}

export function buildCommentary(hook: string, body: string, hashtags: string[]): string {
  const hashtagLine = hashtags.join(' ');
  return [escapeLittleText(hook), '', escapeLittleText(body), '', hashtagLine].join('\n').trim();
}
