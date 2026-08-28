import { useEffect, useState } from 'react';

export default function UpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setRegistration(reg);
      if (reg.waiting) setNeedsRefresh(true);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            if (navigator.serviceWorker.controller) setNeedsRefresh(true);
            else setOfflineReady(true);
          }
        });
      });
    }).catch(() => undefined);
  }, []);

  if (!needsRefresh && !offlineReady) return null;
  return <aside className="update-toast" role="status">
    <p>{needsRefresh ? 'A fresh version of the Atlas is ready.' : 'The Atlas is ready for offline browsing.'}</p>
    <div>
      {needsRefresh && <button className="button" type="button" onClick={() => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })}>Update now</button>}
      <button className="button button--light" type="button" onClick={() => { setNeedsRefresh(false); setOfflineReady(false); }}>Dismiss</button>
    </div>
  </aside>;
}
