import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { AnimatePresence, MotionConfig } from 'motion/react';
import 'maplibre-gl/dist/maplibre-gl.css';
import poisData from '../../data/pois.json';
import ArchiveModal from './ArchiveModal';
import ScrollArea from './ScrollArea';
import YouTubePlayer from './YouTubePlayer';

type Poi = (typeof poisData.pois)[number];
const allPois = poisData.pois as Poi[];

function readInitial() {
  if (typeof window === 'undefined') return { q: '', season: '', province: '', year: '' };
  let oldHash = '';
  try { oldHash = decodeURIComponent(location.hash.replace(/^#\//, '')).replace(/\+/g, ' '); } catch { oldHash = ''; }
  const p = new URLSearchParams(location.search);
  return { q: p.get('q') || oldHash, season: p.get('season') || '', province: p.get('province') || '', year: p.get('year') || '' };
}

/** The pin icon, redrawn on demand: a style reload throws away every image the map held. */
function drawPinImage() {
  const pin = document.createElement('canvas');
  pin.width = 48;
  pin.height = 56;
  const context = pin.getContext('2d');
  if (!context) return null;
  context.scale(2, 2);
  context.beginPath();
  context.moveTo(12, 27);
  context.bezierCurveTo(10.5, 23.5, 3, 16.8, 3, 10.8);
  context.arc(12, 10.8, 9, Math.PI, 0);
  context.bezierCurveTo(21, 16.8, 13.5, 23.5, 12, 27);
  context.closePath();
  context.fillStyle = '#ff453a';
  context.fill();
  context.lineWidth = 1.25;
  context.strokeStyle = '#ffd7d4';
  context.stroke();
  context.beginPath();
  context.arc(12, 10.8, 3.2, 0, Math.PI * 2);
  context.fillStyle = '#fff';
  context.fill();
  return context.getImageData(0, 0, pin.width, pin.height);
}

export default function AtlasExplorer() {
  const [filters, setFilters] = useState(readInitial);
  const [selected, setSelected] = useState<Poi[]>([]);
  const [activePoi, setActivePoi] = useState<Poi | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [mapError, setMapError] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(location.search).get('archive') === '1');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archiveActivePoi, setArchiveActivePoi] = useState<Poi | null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const cursorHandlersBound = useRef(false);
  const mapPress = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const mapReady = styleEpoch > 0;
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
    if (archiveOpen) p.set('archive', '1');
    history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`);
  }, [archiveOpen, filters]);

  useEffect(() => {
    if (!archiveOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setArchiveActivePoi(null); setArchiveOpen(false); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [archiveOpen]);

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    let cancelled = false;
    // v6 no longer resolves its worker through import.meta.url under a bundler, so point it at
    // the worker chunk Vite emits or no vector tiles ever load.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')]).then(([maplibregl, worker]) => {
      if (cancelled || !mapElement.current) return;
      maplibregl.setWorkerUrl(worker.default);
      const instance = new maplibregl.Map({ container: mapElement.current, style: 'https://tiles.openfreemap.org/styles/dark', center: [-96, 58], zoom: 3, minZoom: 2, attributionControl: false });
      map.current = instance;
      const styleTimeout = window.setTimeout(() => {
        if (!instance.isStyleLoaded()) setMapError(true);
      }, 15000);
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      // Counted, not a boolean: a WebGL context restore reloads the style and drops the source,
      // the layers and the pin image, and a second `true` would not re-run the effect that re-adds them.
      instance.on('style.load', () => {
        window.clearTimeout(styleTimeout);
        setMapError(false);
        setStyleEpoch(epoch => epoch + 1);
      });
      instance.setMissingStyleImageResolver(id => {
        if (id !== 'atlas-pin' || instance.hasImage('atlas-pin')) return;
        const image = drawPinImage();
        if (image) instance.addImage('atlas-pin', image, { pixelRatio: 2 });
      });
      instance.on('error', () => { if (!instance.isStyleLoaded()) setMapError(true); });
    }).catch(() => setMapError(true));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    const matchingIds = new Set(filtered.map(p => p.id));
    const features = allPois.map(p => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [Number(p.coordinates.longitude), Number(p.coordinates.latitude)] }, properties: { id: p.id, matched: matchingIds.has(p.id) } }));
    const geojson = { type: 'FeatureCollection' as const, features };
    // Re-apply whatever is missing rather than assuming the first pass was the only one: after a
    // style reload the map keeps running but the source, the layers and the image are all gone.
    // Between styles every source and layer call throws, so a failed pass is skipped and retried
    // on the next style load rather than being allowed to tear the whole explorer down.
    try {
      const source = instance.getSource('atlas') as import('maplibre-gl').GeoJSONSource | undefined;
      if (source) source.setData(geojson);
      else instance.addSource('atlas', { type: 'geojson', data: geojson });
      if (!instance.hasImage('atlas-pin')) {
        const image = drawPinImage();
        if (image) instance.addImage('atlas-pin', image, { pixelRatio: 2 });
      }
      if (!instance.getLayer('atlas-pin-hit')) instance.addLayer({ id: 'atlas-pin-hit', type: 'circle', source: 'atlas', paint: { 'circle-radius': 18, 'circle-color': '#ff453a', 'circle-opacity': .001 } });
      if (!instance.getLayer('atlas-pins')) instance.addLayer({ id: 'atlas-pins', type: 'symbol', source: 'atlas', layout: { 'icon-image': 'atlas-pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 2, .62, 7, .82] }, paint: { 'icon-opacity': ['case', ['get', 'matched'], .96, .2] } });
      if (!cursorHandlersBound.current) {
        cursorHandlersBound.current = true;
        for (const layer of ['atlas-pin-hit', 'atlas-pins']) {
          instance.on('mouseenter', layer, () => instance.getCanvas().style.cursor = 'pointer');
          instance.on('mouseleave', layer, () => instance.getCanvas().style.cursor = '');
        }
      }
    } catch {
      // Mid-reload; the style.load that follows bumps the epoch and runs this again.
    }
  }, [filtered, styleEpoch]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady || filtered.length === 0 || filtered.length === allPois.length) return;
    const longitudes = filtered.map((poi) => Number(poi.coordinates.longitude));
    const latitudes = filtered.map((poi) => Number(poi.coordinates.latitude));
    instance.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 70, maxZoom: 10, duration: 700 });
  }, [filtered, mapReady]);

  const update = (key: keyof typeof filters, value: string) => {
    setActivePoi(null);
    setSelected([]);
    setFilters(current => ({ ...current, [key]: value }));
  };
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const visibleResults = selected.length > 0 ? selected : filtered;
  const selectPlaceAt = (clientX: number, clientY: number) => {
    const instance = map.current;
    if (!instance) return;
    const bounds = instance.getCanvas().getBoundingClientRect();
    const feature = instance.queryRenderedFeatures([clientX - bounds.left, clientY - bounds.top], { layers: ['atlas-pins', 'atlas-pin-hit'] })[0];
    const poi = allPois.find(p => p.id === feature?.properties?.id);
    if (!poi) return;
    if (window.matchMedia('(max-width: 760px)').matches) {
      setSelected([poi]);
      setActivePoi(poi);
      setSheetExpanded(true);
      return;
    }
    setArchiveActivePoi(poi);
    setArchiveOpen(true);
    setSheetExpanded(false);
  };
  const beginMapPress = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    mapPress.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const endMapPress = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = mapPress.current;
    mapPress.current = null;
    if (!press || press.pointerId !== event.pointerId || !event.isPrimary || (event.target as Element).closest('a')) return;
    // Let MapLibre own pans, pinches and drags. A location opens only after a
    // stationary tap, rather than from the pointer-up event that ends a drag.
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) return;
    selectPlaceAt(event.clientX, event.clientY);
  };
  const showArchivePoi = useCallback((poi: Poi) => { setArchiveActivePoi(poi); }, []);
  const closeArchivePoi = useCallback(() => setArchiveActivePoi(null), []);
  const closeArchive = useCallback(() => { setArchiveActivePoi(null); setArchiveOpen(false); }, []);
  const showSearchPoi = (poi: Poi) => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setActivePoi(poi);
      return;
    }
    setActivePoi(null);
    setArchiveActivePoi(poi);
    setArchiveOpen(true);
    setSheetExpanded(false);
  };

  return <MotionConfig reducedMotion="user"><section className="explorer" aria-label="Atlas explorer">
    <div className="map-stage" onPointerDownCapture={beginMapPress} onPointerUpCapture={endMapPress} onPointerCancelCapture={() => { mapPress.current = null; }}>
      <div ref={mapElement} className="map-canvas" aria-label="Interactive map of Atlas locations" />
      {mapError && <div className="map-fallback"><strong>The map is taking the scenic route.</strong><span>Search and every archive entry remain available in the sheet.</span></div>}
      <div className="map-attribution"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · Data © OpenStreetMap contributors</div>
    </div>
    <aside className={`map-sheet ${sheetExpanded ? 'is-expanded' : ''}`} aria-label="Search and Atlas results">
      <button className="sheet-handle" type="button" onClick={() => setSheetExpanded(value => !value)} aria-label={sheetExpanded ? 'Collapse search sheet' : 'Expand search sheet'}><span /></button>
      <div className="sheet-search-row">
        <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Search the archive</span><input value={filters.q} onFocus={() => setSheetExpanded(true)} onChange={e => { update('q', e.target.value); setSheetExpanded(true); }} placeholder="Search the Atlas" autoComplete="off" /></label>
      </div>
      <div className="sheet-summary"><div><strong>{activePoi ? activePoi.title : selected.length ? `${selected.length} at this location` : `${filtered.length} adventures`}</strong><span>{activePoi ? activePoi.locationLabel : selected.length ? selected[0]?.locationLabel : hasActiveFilters ? 'Matching your search' : 'Across Canada'}</span></div>{(hasActiveFilters || selected.length > 0 || activePoi) && <button type="button" onClick={() => activePoi ? setActivePoi(null) : selected.length ? setSelected([]) : setFilters({ q: '', season: '', province: '', year: '' })}>{activePoi || selected.length ? 'Back' : 'Clear'}</button>}</div>
      <div className="filter-row">
        <select aria-label="Season" value={filters.season} onChange={e => { update('season', e.target.value); setSheetExpanded(true); }}><option value="">Season</option>{seasons.map(x => <option key={x} value={x}>Season {x}</option>)}</select>
        <select aria-label="Province or territory" value={filters.province} onChange={e => { update('province', e.target.value); setSheetExpanded(true); }}><option value="">Province</option>{provinces.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
        <select aria-label="Broadcast year" value={filters.year} onChange={e => { update('year', e.target.value); setSheetExpanded(true); }}><option value="">Year</option>{years.map(x => <option key={x!} value={x!}>{x}</option>)}</select>
      </div>
      <ScrollArea className="sheet-results" aria-live="polite" aria-label="Search results">{activePoi ? <article className="place-detail-card"><div className="place-detail-card__media"><YouTubePlayer videoId={activePoi.video.youtubeId} title={activePoi.title} thumbnailUrl={activePoi.video.thumbnailUrl} /></div><div className="place-detail-card__body"><p className="result-card__meta">Season {activePoi.season} · Episode {activePoi.episode}</p><h2>{activePoi.title}</h2><p className="place-detail-card__location">⌖ {activePoi.locationLabel}</p><p>{activePoi.description || `An Atlas stop in ${activePoi.locationLabel}.`}</p><dl className="place-detail-card__facts"><div><dt>Aired</dt><dd>{activePoi.broadcastDate || activePoi.broadcastYear}</dd></div><div><dt>Region</dt><dd>{activePoi.province || 'Canada'}</dd></div></dl></div></article> : visibleResults.length === 0 ? <div className="empty-result"><strong>No stops match that search.</strong><span>Try another city, title, or filter.</span></div> : visibleResults.slice(0, sheetExpanded ? 30 : 3).map(p => <button className="result-card" type="button" onClick={() => showSearchPoi(p)} key={p.id}><img className="result-card__media" src={p.video.thumbnailUrl} alt="" loading="lazy" /><span className="result-card__body"><span className="result-card__meta">S{p.season} E{p.episode} · {p.broadcastYear}</span><strong>{p.title}</strong><span>{p.locationLabel}</span></span></button>)}</ScrollArea>
    </aside>
    <AnimatePresence>{archiveOpen && <ArchiveModal key="archive-modal" query={archiveQuery} onQueryChange={setArchiveQuery} activePoi={archiveActivePoi} onSelect={showArchivePoi} onBack={closeArchivePoi} onClose={closeArchive} />}</AnimatePresence>
  </section></MotionConfig>;
}
