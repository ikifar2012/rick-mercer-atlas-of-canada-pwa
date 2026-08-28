/** Offline integrity and schema audit for data/pois.json. Run with Bun. */
import { createHash } from 'node:crypto';

type AtlasPoi = {
  id: string; slug: string; description: string | null; locationLabel: string; season: number; episode: number; broadcastYear: number; broadcastDate: string;
  province: string | null; provinceCode: string | null;
  coordinates: { latitude: number; longitude: number };
  video: { youtubeId: string; thumbnailUrl: string; durationSeconds: number | null };
  source: { legacyGuid: string; legacyBroadcast: string };
};
type Dataset = { schemaVersion: number; source: { url: string; sha256: string; recordCount: number }; pois: AtlasPoi[] };

const dataset = JSON.parse(await Bun.file(new URL('../data/pois.json', import.meta.url)).text()) as Dataset;
const raw = await Bun.file(new URL('../data/source/rmr.atlas.data.js', import.meta.url)).text();
const fail = (message: string): never => { throw new Error(message); };
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sourceAssignment = /^\s*var\s+RMRatlasdata\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(raw);
if (!sourceAssignment) fail('Archived source is not the expected RMRatlasdata assignment.');
const legacy = JSON.parse(sourceAssignment[1]) as { rmratlas: { season: Array<{ number: string | number; markers: Array<{ guid: string }> }> } };
const legacySeasons = new Map(legacy.rmratlas.season.flatMap((season) => season.markers.map((marker) => [marker.guid, Number(season.number)])));

if (dataset.schemaVersion !== 1) fail('Expected schemaVersion 1.');
if (dataset.source?.url !== 'https://www.rickmercer.com/atlasofcanada/rmr.atlas.data.js') fail('Unexpected source URL.');
if (dataset.source?.recordCount !== 486 || dataset.pois?.length !== 486) fail(`Expected 486 POIs; got ${dataset.pois?.length}.`);
const checksum = createHash('sha256').update(raw).digest('hex');
if (dataset.source.sha256 !== checksum) fail('Source checksum does not match the archived legacy file.');
if (legacySeasons.size !== 486) fail(`Expected 486 unique archived legacy markers; got ${legacySeasons.size}.`);

const ids = new Set<string>(), slugs = new Set<string>();
for (const poi of dataset.pois) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(poi.id)) fail(`Invalid ID: ${poi.id}`);
  if (ids.has(poi.id)) fail(`Duplicate ID: ${poi.id}`); ids.add(poi.id);
  if (legacySeasons.get(poi.id) !== poi.season) fail(`Season does not match archived source: ${poi.id}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(poi.slug)) fail(`Invalid slug: ${poi.slug}`);
  if (slugs.has(poi.slug)) fail(`Duplicate slug: ${poi.slug}`); slugs.add(poi.slug);
  if (!Number.isInteger(poi.season) || !Number.isInteger(poi.episode) || !Number.isInteger(poi.broadcastYear)) fail(`Non-numeric season/episode/year: ${poi.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(poi.broadcastDate) || poi.broadcastYear !== Number(poi.broadcastDate.slice(0, 4))) fail(`Invalid broadcast date: ${poi.id}`);
  if (!isNumber(poi.coordinates?.latitude) || !isNumber(poi.coordinates?.longitude) || poi.coordinates.latitude < -90 || poi.coordinates.latitude > 90 || poi.coordinates.longitude < -180 || poi.coordinates.longitude > 180) fail(`Invalid coordinates: ${poi.id}`);
  if (typeof poi.description !== 'string' && poi.description !== null) fail(`Invalid description: ${poi.id}`);
  if (!poi.locationLabel || !poi.video?.youtubeId || !poi.video.thumbnailUrl.startsWith('https://')) fail(`Video must have an ID and HTTPS thumbnail: ${poi.id}`);
  if (poi.video.durationSeconds !== null && (!Number.isInteger(poi.video.durationSeconds) || poi.video.durationSeconds < 0)) fail(`Invalid video duration: ${poi.id}`);
  if (poi.province === null ? poi.provinceCode !== null : !/^[A-Z]{2}$/.test(poi.provinceCode)) fail(`Invalid province fields: ${poi.id}`);
  if (poi.source?.legacyGuid !== poi.id || typeof poi.source.legacyBroadcast !== 'string') fail(`Missing preserved source metadata: ${poi.id}`);
}
console.log(`Atlas data audit passed: ${dataset.pois.length} unique POIs, checksum ${checksum}.`);
