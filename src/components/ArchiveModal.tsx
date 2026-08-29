import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import poisData from '../../data/pois.json';
import ScrollArea from './ScrollArea';
import YouTubePlayer from './YouTubePlayer';

type Poi = (typeof poisData.pois)[number];

const archivePois = [...(poisData.pois as Poi[])].sort((a, b) => (b.broadcastDate || '').localeCompare(a.broadcastDate || ''));
/** Cards rendered up front, then grown as the viewport nears the end of the list. */
const PAGE_SIZE = 40;

type Props = { query: string; onQueryChange: (value: string) => void; activePoi: Poi | null; onSelect: (poi: Poi) => void; onBack: () => void; onClose: () => void };

/** Memoized so unrelated explorer state (filters, map readiness, the mobile sheet) never re-renders the 486-card archive. */
function ArchiveModal({ query, onQueryChange, activePoi, onSelect, onBack, onClose }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [renderedQuery, setRenderedQuery] = useState(query);
  const searchInput = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const listScrollTop = useRef(0);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return !needle ? archivePois : archivePois.filter(p => `${p.title} ${p.description || ''} ${p.locationLabel}`.toLocaleLowerCase().includes(needle));
  }, [query]);

  // Reset during render, not in an effect: an effect would land after the layout effect below
  // and undo the growth it had just queued, leaving the list stuck at one page.
  if (query !== renderedQuery) {
    setRenderedQuery(query);
    setLimit(PAGE_SIZE);
  }

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onScroll = () => {
      listScrollTop.current = element.scrollTop;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 600) setLimit(current => (current < results.length ? current + PAGE_SIZE : current));
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [results.length]);

  // Safety net: a render can leave the end of the list already in view (first paint on a tall
  // screen, or a search that shrank the results), and no scroll event would follow to grow it.
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || activePoi || limit >= results.length) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 600) setLimit(current => current + PAGE_SIZE);
  });

  // The list stays mounted behind the detail view, so restore where the reader left off.
  useLayoutEffect(() => { if (!activePoi && viewport.current) viewport.current.scrollTop = listScrollTop.current; }, [activePoi]);
  // Matches the autoFocus the list used to get by remounting whenever the detail view closed.
  useEffect(() => { if (!activePoi) searchInput.current?.focus(); }, [activePoi]);

  const hideList = activePoi ? { display: 'none' } : undefined;

  return <motion.div className="archive-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18, ease: 'easeOut' }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><motion.section className={`archive-modal__panel ${activePoi ? 'is-detail' : ''}`} role="dialog" aria-modal="true" aria-labelledby="archive-modal-title" initial={{ opacity: 0, y: 12, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .99 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
    <header>{activePoi ? <div><p className="eyebrow">{activePoi.locationLabel}</p><h2 id="archive-modal-title">{activePoi.title}</h2><p>Season {activePoi.season} · Episode {activePoi.episode} · {activePoi.broadcastYear}</p></div> : <div><p className="eyebrow">The complete archive</p><h2 id="archive-modal-title">All places</h2><p>Choose an adventure to view its story.</p></div>}<button className="archive-modal__close" type="button" onClick={onClose} aria-label="Close all places"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg></button></header>
    <label className="archive-modal__search" style={hideList}><span aria-hidden="true">⌕</span><span className="sr-only">Search all places</span><input ref={searchInput} value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search all places" autoFocus /></label>
    <p className="archive-modal__count" style={hideList}>{results.length} adventures</p>
    <ScrollArea className="archive-modal__results" style={hideList} viewportRef={viewport} aria-label="All adventures">{results.slice(0, limit).map(poi => <button className="archive-modal__card" type="button" onClick={() => { if (viewport.current) listScrollTop.current = viewport.current.scrollTop; onSelect(poi); }} key={poi.id}><img src={poi.video.thumbnailUrl} alt="" loading="lazy" /><span><strong>{poi.title}</strong><small>{poi.locationLabel} · S{poi.season} E{poi.episode} · {poi.broadcastYear}</small></span></button>)}</ScrollArea>
    {activePoi && <ScrollArea className="archive-modal__detail" aria-label="Adventure details"><div className="archive-modal__media"><YouTubePlayer videoId={activePoi.video.youtubeId} title={activePoi.title} thumbnailUrl={activePoi.video.thumbnailUrl} /></div><p>{activePoi.description || `An Atlas stop in ${activePoi.locationLabel}.`}</p><dl className="place-detail-card__facts"><div><dt>Aired</dt><dd>{activePoi.broadcastDate || activePoi.broadcastYear}</dd></div><div><dt>Region</dt><dd>{activePoi.province || 'Canada'}</dd></div></dl><button className="archive-modal__back" type="button" onClick={onBack}>‹ All places</button></ScrollArea>}
  </motion.section></motion.div>;
}

export default memo(ArchiveModal);
