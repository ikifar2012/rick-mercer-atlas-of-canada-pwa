/**
 * Shared site metadata for the unofficial fan archive.
 *
 * Every value here is deliberately explicit about the archive being unofficial and
 * about the original Rick Mercer Atlas of Canada being the source of the data.
 */

/** Full site name, used for <title> on the homepage and for og:site_name. */
export const SITE_NAME = 'The Unofficial Rick Mercer Atlas of Canada';

/** Short suffix appended to per-page titles so they stay readable in search results. */
export const TITLE_SUFFIX = 'Unofficial Rick Mercer Atlas';

/** Default meta description for pages that do not supply their own. */
export const SITE_DESCRIPTION =
  'A fan-made archive of 486 Rick Mercer Atlas of Canada stops, rebuilt for phones and modern browsers. Search by place, season, and broadcast year.';

/** The original site this archive preserves and reimplements. */
export const ORIGINAL_ATLAS_URL = 'https://www.rickmercer.com/atlasofcanada/';
export const ORIGINAL_ATLAS_NAME = 'Rick Mercer Atlas of Canada';

/** Repository used as the fallback contact point for corrections and rights requests. */
export const PROJECT_REPO_URL = 'https://github.com/ikifar2012/rick-mercer-atlas-of-canada-pwa';

/** One-sentence statement of what this project is. Kept identical in tone to the README. */
export const UNOFFICIAL_NOTICE =
  'An independent, unofficial fan archive. Not affiliated with, authorized by, or endorsed by Rick Mercer, CBC, or the programme’s rights holders.';

export const LOCALE = 'en-CA';

/** Full month-name date, e.g. "17 January 2018" -> "January 17, 2018". Falls back to the raw value. */
export function formatBroadcastDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

/** Trim a sentence to a length that survives search-result truncation without cutting mid-word. */
export function clampSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '')}…`;
}
