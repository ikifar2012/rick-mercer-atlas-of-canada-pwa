import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import poisData from '../../data/pois.json';

type Poi = (typeof poisData.pois)[number];
const allPois = poisData.pois as Poi[];

function readInitial() {
  if (typeof window === 'undefined') return { q: '', season: '', province: '', year: '' };
  let oldHash = '';
  try { oldHash = decodeURIComponent(location.hash.replace(/^#\//, '')).replace(/\+/g, ' '); } catch { oldHash = ''; }
  const p = new URLSearchParams(location.search);
  return { q: p.get('q') || oldHash, season: p.get('season') || '', province: p.get('province') || '', year: p.get('year') || '' };
}

export default function AtlasExplorer() {
  const [filters, setFilters] = useState(readInitial);
  const [selected, setSelected] = useState<Poi[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  const seasons = useMemo(() => [...new Set(allPois.map(p => p.season))].sort((a, b) => b - a), []);
  const provinces = useMemo(() => [...new Set(allPois.map(p => p.province).filter(Boolean))].sort(), []);
  const years = useMemo(() => [...new Set(allPois.map(p => p.broadcastYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), []);
  const filtered = useMemo(() => {
    const query = filters.q.trim().toLocaleLowerCase();
    return allPois.filter(p => (!query || `${p.title} ${p.description || ''} ${p.locationLabel}`.toLocaleLowerCase().includes(query)) && (!filters.season || String(p.season) === filters.season) && (!filters.province || p.province === filters.province) && (!filters.year || String(p.broadcastYear) === filters.year));
  }, [filters]);

  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && p.set(key, value));
    history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`);
  }, [filters]);

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    let cancelled = false;
    import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !mapElement.current) return;
      const instance = new maplibregl.Map({ container: mapElement.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-96, 58], zoom: 3, minZoom: 2 });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => { setMapReady(true); });
      instance.on('error', () => setMapError(true));
    }).catch(() => setMapError(true));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    const source = instance.getSource('atlas') as import('maplibre-gl').GeoJSONSource | undefined;
    const features = filtered.map(p => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [Number(p.coordinates.longitude), Number(p.coordinates.latitude)] }, properties: { id: p.id } }));
    const geojson = { type: 'FeatureCollection' as const, features };
    if (source) source.setData(geojson);
    else {
      instance.addSource('atlas', { type: 'geojson', data: geojson });
      instance.addLayer({ id: 'atlas-halo', type: 'circle', source: 'atlas', paint: { 'circle-radius': 10, 'circle-color': '#fff7e8', 'circle-opacity': .9 } });
      instance.addLayer({ id: 'atlas-points', type: 'circle', source: 'atlas', paint: { 'circle-radius': 6, 'circle-color': '#d62828', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#171512' } });
      instance.on('mouseenter', 'atlas-points', () => instance.getCanvas().style.cursor = 'pointer');
      instance.on('mouseleave', 'atlas-points', () => instance.getCanvas().style.cursor = '');
      instance.on('click', 'atlas-points', e => {
        const point = e.features?.[0]?.geometry;
        if (!point || point.type !== 'Point') return;
        const [lng, lat] = point.coordinates;
        setSelected(filtered.filter(p => Number(p.coordinates.longitude) === lng && Number(p.coordinates.latitude) === lat));
      });
    }
  }, [filtered, mapReady]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady || filtered.length === 0 || filtered.length === allPois.length) return;
    const longitudes = filtered.map((poi) => Number(poi.coordinates.longitude));
    const latitudes = filtered.map((poi) => Number(poi.coordinates.latitude));
    instance.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 70, maxZoom: 10, duration: 700 });
  }, [filtered, mapReady]);

  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const nearMe = () => navigator.geolocation?.getCurrentPosition(({ coords }) => map.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 8 }), () => undefined, { timeout: 8000 });
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return <section className="explorer" aria-label="Atlas explorer">
    <div className="explorer__toolbar">
      <div className="search-wrap"><label className="search-box"><span className="sr-only">Search the archive</span><input value={filters.q} onChange={e => update('q', e.target.value)} placeholder="Search a location, title or adventure…" autoComplete="off" /></label></div>
      <div className="filter-row">
        <select aria-label="Season" value={filters.season} onChange={e => update('season', e.target.value)}><option value="">All seasons</option>{seasons.map(x => <option key={x} value={x}>Season {x}</option>)}</select>
        <select aria-label="Province or territory" value={filters.province} onChange={e => update('province', e.target.value)}><option value="">All Canada</option>{provinces.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
        <select aria-label="Broadcast year" value={filters.year} onChange={e => update('year', e.target.value)}><option value="">Any year</option>{years.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
        <button className="button button--ghost" onClick={nearMe} type="button">Near me</button>
        <button className="button button--ghost" onClick={() => setFilters({ q: '', season: '', province: '', year: '' })} type="button">Reset</button>
      </div>
      <p className="results-count" aria-live="polite"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'adventure' : 'adventures'} found</p>
    </div>
    <div className="map-stage">
      <div ref={mapElement} className="map-canvas" aria-label="Interactive map of Atlas locations" />
      {mapError && <div className="map-fallback"><strong>The map is taking the scenic route.</strong><span>The complete archive is still available below.</span></div>}
      <div className="map-attribution"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · Data © OpenStreetMap contributors</div>
    </div>
    <aside className={`results-sheet ${selected.length ? 'is-open' : ''}`} aria-label="Selected location" aria-live="polite">
      {selected.length > 0 && <><button className="sheet-close" onClick={() => setSelected([])} aria-label="Close selected location">×</button><p className="eyebrow">At this location · {selected.length} {selected.length === 1 ? 'story' : 'stories'}</p>{selected.map(p => <a className="result-card" href={`/places/${p.slug}`} key={p.id}><img className="result-card__media" src={p.video.thumbnailUrl} alt="" loading="lazy" /><span className="result-card__body"><span className="result-card__meta">S{p.season} E{p.episode} · {p.broadcastYear}</span><strong>{p.title}</strong><span>{p.locationLabel}</span></span></a>)}</>}
    </aside>
    {hasActiveFilters && selected.length === 0 && <div className="mobile-results" aria-label="Filtered results">{filtered.length === 0 ? <div className="empty-result"><strong>No stops match that search.</strong><span>Try a city, province, title, or clear a filter.</span></div> : filtered.slice(0, 8).map(p => <a className="result-card" href={`/places/${p.slug}`} key={p.id}><img className="result-card__media" src={p.video.thumbnailUrl} alt="" loading="lazy" /><span className="result-card__body"><span className="result-card__meta">S{p.season} E{p.episode}</span><strong>{p.title}</strong><span>{p.locationLabel}</span></span></a>)}</div>}
  </section>;
}
