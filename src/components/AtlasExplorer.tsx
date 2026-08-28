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
  const [sheetExpanded, setSheetExpanded] = useState(false);
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
      const instance = new maplibregl.Map({ container: mapElement.current, style: 'https://tiles.openfreemap.org/styles/dark', center: [-96, 58], zoom: 3, minZoom: 2 });
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
      instance.addLayer({ id: 'atlas-halo', type: 'circle', source: 'atlas', paint: { 'circle-radius': 11, 'circle-color': '#ff5360', 'circle-opacity': .22, 'circle-blur': .35 } });
      instance.addLayer({ id: 'atlas-points', type: 'circle', source: 'atlas', paint: { 'circle-radius': 5.5, 'circle-color': '#ff453a', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffd7d4' } });
      instance.on('mouseenter', 'atlas-points', () => instance.getCanvas().style.cursor = 'pointer');
      instance.on('mouseleave', 'atlas-points', () => instance.getCanvas().style.cursor = '');
      instance.on('click', 'atlas-points', e => {
        const point = e.features?.[0]?.geometry;
        if (!point || point.type !== 'Point') return;
        const [lng, lat] = point.coordinates;
        setSelected(filtered.filter(p => Number(p.coordinates.longitude) === lng && Number(p.coordinates.latitude) === lat));
        setSheetExpanded(true);
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

  const visibleResults = selected.length > 0 ? selected : filtered;

  return <section className="explorer" aria-label="Atlas explorer">
    <div className="map-stage">
      <div ref={mapElement} className="map-canvas" aria-label="Interactive map of Atlas locations" />
      {mapError && <div className="map-fallback"><strong>The map is taking the scenic route.</strong><span>Search and every archive entry remain available in the sheet.</span></div>}
      <div className="map-attribution"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · Data © OpenStreetMap contributors</div>
    </div>
    <aside className={`map-sheet ${sheetExpanded ? 'is-expanded' : ''}`} style={sheetExpanded ? { height: 'min(78svh, 46rem)', maxHeight: 'min(78svh, 46rem)' } : undefined} aria-label="Search and Atlas results">
      <button className="sheet-handle" type="button" onClick={() => setSheetExpanded(value => !value)} aria-label={sheetExpanded ? 'Collapse search sheet' : 'Expand search sheet'}><span /></button>
      <div className="sheet-search-row">
        <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Search the archive</span><input value={filters.q} onFocus={() => setSheetExpanded(true)} onChange={e => { update('q', e.target.value); setSheetExpanded(true); }} placeholder="Search the Atlas" autoComplete="off" /></label>
        <button className="round-action" onClick={nearMe} type="button" aria-label="Show my location">⌖</button>
      </div>
      <div className="sheet-summary"><div><strong>{selected.length ? `${selected.length} at this location` : `${filtered.length} adventures`}</strong><span>{selected.length ? selected[0]?.locationLabel : hasActiveFilters ? 'Matching your search' : 'Across Canada'}</span></div>{(hasActiveFilters || selected.length > 0) && <button type="button" onClick={() => selected.length ? setSelected([]) : setFilters({ q: '', season: '', province: '', year: '' })}>{selected.length ? 'Back' : 'Clear'}</button>}</div>
      <div className="sheet-places" aria-label="Explore the Atlas">
        <button type="button" onClick={() => { setFilters({ q: '', season: '', province: '', year: '' }); setSheetExpanded(true); }}><span aria-hidden="true">⌾</span><strong>All Stops</strong><small>486 places</small></button>
        <button type="button" onClick={nearMe}><span aria-hidden="true">↗</span><strong>Near Me</strong><small>Explore nearby</small></button>
        <button type="button" onClick={() => { setFilters({ q: '', season: String(seasons[0]), province: '', year: '' }); setSheetExpanded(true); }}><span aria-hidden="true">✦</span><strong>Latest</strong><small>Season {seasons[0]}</small></button>
      </div>
      <div className="filter-row">
        <select aria-label="Season" value={filters.season} onChange={e => { update('season', e.target.value); setSheetExpanded(true); }}><option value="">Season</option>{seasons.map(x => <option key={x} value={x}>Season {x}</option>)}</select>
        <select aria-label="Province or territory" value={filters.province} onChange={e => { update('province', e.target.value); setSheetExpanded(true); }}><option value="">Province</option>{provinces.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
        <select aria-label="Broadcast year" value={filters.year} onChange={e => { update('year', e.target.value); setSheetExpanded(true); }}><option value="">Year</option>{years.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
      </div>
      <div className="sheet-results" aria-live="polite">{visibleResults.length === 0 ? <div className="empty-result"><strong>No stops match that search.</strong><span>Try another city, title, or filter.</span></div> : visibleResults.slice(0, sheetExpanded ? 30 : 3).map(p => <a className="result-card" href={`/places/${p.slug}`} key={p.id}><img className="result-card__media" src={p.video.thumbnailUrl} alt="" loading="lazy" /><span className="result-card__body"><span className="result-card__meta">S{p.season} E{p.episode} · {p.broadcastYear}</span><strong>{p.title}</strong><span>{p.locationLabel}</span></span></a>)}</div>
    </aside>
  </section>;
}
