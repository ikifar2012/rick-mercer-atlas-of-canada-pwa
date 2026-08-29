import { useEffect } from 'react';
import { toast, Toaster } from './Toast';

export default function UpdatePrompt() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(item => item.unregister()))).catch(() => undefined);
      return;
    }
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
    const showUpdate = (registration: ServiceWorkerRegistration) => {
      toast.add({ id: 'atlas-update', type: 'info', timeout: 0, title: 'A fresh Atlas is ready', description: 'Update now to see the latest map and archive.', actionProps: { children: 'Update now', onClick: () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }) } });
    };
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting) showUpdate(reg);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            if (navigator.serviceWorker.controller) showUpdate(reg);
            else toast.add({ id: 'atlas-offline', type: 'success', title: 'Offline browsing is ready', description: 'The Atlas is available on your next trip.' });
          }
        });
      });
    }).catch(() => undefined);
  }, []);

  return <Toaster />;
}
