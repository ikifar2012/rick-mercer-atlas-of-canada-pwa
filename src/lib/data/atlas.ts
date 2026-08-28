/** Type contract for the normalized Rick Mercer Atlas canonical dataset. */
export interface AtlasPoi {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  locationLabel: string;
  province: string | null;
  provinceCode: string | null;
  season: number;
  episode: number;
  broadcastDate: string;
  broadcastYear: number;
  coordinates: { latitude: number; longitude: number };
  video: { youtubeId: string; thumbnailUrl: string; durationSeconds: number | null; aspect: string | null };
  source: { legacyGuid: string; legacyEpisode: string; legacyBroadcast: string };
}

export interface AtlasDataset {
  schemaVersion: 1;
  source: { url: string; filename: string; sha256: string; lastModified: string; etag: string; recordCount: number };
  pois: AtlasPoi[];
}
