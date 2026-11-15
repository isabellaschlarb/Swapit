// "For You" ranking. Plain math, no AI call, so the feed is fast and free.
//
// Each item gets:
//   style score   = for each of the item's style tags:
//                     +2 if it's one of MY profile tags
//                     +1 for every item I liked that has that tag (max +3 per tag)
//   fresh score   = up to +2 for brand-new items, fading to 0 over 14 days
//   total         = style score + fresh score   (highest first)
//
// The top few items with a real style match get a "Matches your style" badge.

const PROFILE_TAG_POINTS = 2;
const LIKED_TAG_POINTS = 1;
const MAX_LIKED_POINTS_PER_TAG = 3;
const FRESH_POINTS = 2;
const FRESH_DAYS = 14;
const BADGE_COUNT = 6; // how many items can get the badge
const BADGE_MIN_STYLE = 2; // at least one profile tag, or two liked-tag hits

type Rankable = { id: string; style_tags: string[]; created_at: string };

export function rankForYou<T extends Rankable>(
  items: T[],
  myTags: string[],
  likedItemTags: string[][],
  now = Date.now(),
): { items: T[]; matchIds: Set<string> } {
  // How many points each tag is worth to me.
  const tagPoints = new Map<string, number>();
  for (const tag of myTags) tagPoints.set(tag, PROFILE_TAG_POINTS);
  const likedCounts = new Map<string, number>();
  for (const tags of likedItemTags) for (const tag of tags) likedCounts.set(tag, (likedCounts.get(tag) ?? 0) + 1);
  for (const [tag, count] of likedCounts) {
    tagPoints.set(tag, (tagPoints.get(tag) ?? 0) + Math.min(count, MAX_LIKED_POINTS_PER_TAG) * LIKED_TAG_POINTS);
  }

  const scored = items.map((item) => {
    const style = item.style_tags.reduce((sum, tag) => sum + (tagPoints.get(tag) ?? 0), 0);
    const ageDays = (now - new Date(item.created_at).getTime()) / 86_400_000;
    const fresh = Math.max(0, 1 - ageDays / FRESH_DAYS) * FRESH_POINTS;
    return { item, style, total: style + fresh };
  });

  scored.sort((a, b) => b.total - a.total);

  const matchIds = new Set(
    [...scored]
      .filter((s) => s.style >= BADGE_MIN_STYLE)
      .sort((a, b) => b.style - a.style)
      .slice(0, BADGE_COUNT)
      .map((s) => s.item.id),
  );

  return { items: scored.map((s) => s.item), matchIds };
}
