/**
 * Fetch and normalize the legacy Rick Mercer Atlas marker file. Run with Bun.
 *
 * Usage:
 *   bun scripts/migrate-atlas-data.ts
 *   bun scripts/migrate-atlas-data.ts --input data/source/rmr.atlas.data.js
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Shape of the upstream rmr.atlas.data.js payload; every field arrives as a string. */
type LegacyMarker = {
  guid: string;
  episode: string;
  title: string;
  broadcast: string;
  description: string;
  location: string;
  point: { lat: string | number; long: string | number };
  video: { id: string; duration: string; aspect: string };
};
type LegacySeason = { number: string | number; markers: LegacyMarker[] };
type LegacyDataset = { rmratlas?: { season?: LegacySeason[] } };

type AtlasPoi = {
  id: string; slug: string; title: string; description: string | null; locationLabel: string;
  province: string | null; provinceCode: string | null;
  season: number; episode: number; broadcastDate: string; broadcastYear: number;
  coordinates: { latitude: number; longitude: number };
  video: { youtubeId: string; thumbnailUrl: string; durationSeconds: number | null; aspect: string | null };
  source: { legacyGuid: string; legacyEpisode: string; legacyBroadcast: string };
};
type Dataset = {
  schemaVersion: number;
  source: { url: string; filename: string; sha256: string; lastModified: string; etag: string; recordCount: number };
  pois: AtlasPoi[];
};

const SOURCE_URL = 'https://www.rickmercer.com/atlasofcanada/rmr.atlas.data.js';
const ROOT = resolve(import.meta.dirname, '..');
const RAW_PATH = resolve(ROOT, 'data/source/rmr.atlas.data.js');
const OUTPUT_PATH = resolve(ROOT, 'data/pois.json');
const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const CANADIAN_REGIONS = new Map<string, string>([
  ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'],
  ['NL', 'Newfoundland and Labrador'], ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'],
  ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['PEI', 'Prince Edward Island'],
  ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon'], ['Ontario', 'Ontario'],
]);

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'poi';
}

function parseBroadcast(value: string): string {
  // One legacy marker only names its broadcast year; use the ISO date's lowest
  // possible day while retaining the unaltered value in source.legacyBroadcast.
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) throw new Error(`Unsupported broadcast date: ${value}`);
  const [, month, day, year] = match;
  return `${year}-${String(MONTHS[month] + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function regionFromLocation(location: string): { province: string | null; provinceCode: string | null } {
  const parts = location.split(',').map((part) => part.trim());
  const suffix = parts.at(-1)?.replace(/\.$/, '');
  const province = suffix === undefined ? undefined : CANADIAN_REGIONS.get(suffix);
  if (suffix === undefined || province === undefined) return { province: null, provinceCode: null };
  const provinceCode = suffix === 'PEI' ? 'PE' : suffix === 'Ontario' ? 'ON' : suffix;
  return { province, provinceCode };
}

function parseLegacy(source: string): LegacyDataset {
  const match = /^\s*var\s+RMRatlasdata\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(source);
  if (!match) throw new Error('The legacy file is not the expected RMRatlasdata assignment.');
  return JSON.parse(match[1]) as LegacyDataset;
}

async function getSource(): Promise<{ text: string; headers: Record<string, string> }> {
  const inputFlag = process.argv.indexOf('--input');
  if (inputFlag !== -1) return { text: await readFile(resolve(ROOT, process.argv[inputFlag + 1]), 'utf8'), headers: {} };
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Could not fetch source: ${response.status} ${response.statusText}`);
  return { text: await response.text(), headers: Object.fromEntries(response.headers.entries()) };
}

const { text: legacyText, headers } = await getSource();
const legacy = parseLegacy(legacyText);
const markers = legacy.rmratlas?.season?.flatMap((season) => season.markers.map((marker) => ({ marker, season: Number(season.number) })));
if (!Array.isArray(markers)) throw new Error('No legacy markers found.');

const usedSlugs = new Map<string, number>();
const pois: AtlasPoi[] = markers.map(({ marker, season }) => {
  const broadcastDate = parseBroadcast(marker.broadcast);
  const slugBase = slugify(`${marker.title}-${marker.location}-${broadcastDate}`);
  const occurrence = (usedSlugs.get(slugBase) ?? 0) + 1;
  usedSlugs.set(slugBase, occurrence);
  const { province, provinceCode } = regionFromLocation(marker.location);
  return {
    id: marker.guid,
    slug: occurrence === 1 ? slugBase : `${slugBase}-${occurrence}`,
    title: marker.title,
    description: marker.description.trim() || null,
    locationLabel: marker.location,
    province,
    provinceCode,
    season,
    episode: Number(marker.episode),
    broadcastDate,
    broadcastYear: Number(broadcastDate.slice(0, 4)),
    coordinates: { latitude: Number(marker.point.lat), longitude: Number(marker.point.long) },
    video: {
      youtubeId: marker.video.id,
      thumbnailUrl: `https://i.ytimg.com/vi/${marker.video.id}/hqdefault.jpg`,
      durationSeconds: marker.video.duration === '' ? null : Number(marker.video.duration),
      aspect: marker.video.aspect || null,
    },
    source: { legacyGuid: marker.guid, legacyEpisode: String(marker.episode), legacyBroadcast: marker.broadcast },
  };
});

const sourceChecksum = sha256(legacyText);
const lastModified = headers['last-modified'] ? new Date(headers['last-modified']).toISOString().replace('.000', '') : '2020-11-30T15:08:19Z';
const dataset: Dataset = {
  schemaVersion: 1,
  source: {
    url: SOURCE_URL,
    filename: 'rmr.atlas.data.js',
    sha256: sourceChecksum,
    lastModified,
    etag: headers.etag ?? '"54642-5b554615e3ec0"',
    recordCount: pois.length,
  },
  pois,
};

await mkdir(dirname(RAW_PATH), { recursive: true });
await writeFile(RAW_PATH, legacyText);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`Wrote ${pois.length} POIs to ${OUTPUT_PATH}`);
console.log(`Source SHA-256: ${sourceChecksum}`);
