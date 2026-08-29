import { Toast as BaseToast } from '@base-ui/react/toast';

export const toast = BaseToast.createToastManager();

function ToastList() {
  const { toasts } = BaseToast.useToastManager();

  return <BaseToast.Viewport className="toast-viewport">
    {toasts.map(item => <BaseToast.Root className="toast" toast={item} key={item.id}>
      <BaseToast.Content className="toast__content">
        <div>
          {item.title && <BaseToast.Title className="toast__title">{item.title}</BaseToast.Title>}
          {item.description && <BaseToast.Description className="toast__description">{item.description}</BaseToast.Description>}
        </div>
        <div className="toast__actions">
          {item.actionProps && <BaseToast.Action className="toast__action" {...item.actionProps} />}
          <BaseToast.Close className="toast__close" aria-label="Dismiss notification"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg></BaseToast.Close>
        </div>
      </BaseToast.Content>
    </BaseToast.Root>)}
  </BaseToast.Viewport>;
}

/** The Base UI implementation bundled by shadcn's current Toast component. */
export function Toaster() {
  return <BaseToast.Provider toastManager={toast} timeout={5000} limit={3}><ToastList /></BaseToast.Provider>;
}
