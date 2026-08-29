import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import type { ReactNode } from 'react';

type Props = BaseScrollArea.Root.Props & { children: ReactNode };

/** The official Base UI primitive used by shadcn's current Scroll Area component. */
export default function ScrollArea({ children, className = '', ...props }: Props) {
  return <BaseScrollArea.Root className={`scroll-area ${className}`.trim()} {...props}>
    <BaseScrollArea.Viewport className="scroll-area__viewport">
      <BaseScrollArea.Content className="scroll-area__content">{children}</BaseScrollArea.Content>
    </BaseScrollArea.Viewport>
    <BaseScrollArea.Scrollbar className="scroll-area__scrollbar" orientation="vertical">
      <BaseScrollArea.Thumb className="scroll-area__thumb" />
    </BaseScrollArea.Scrollbar>
  </BaseScrollArea.Root>;
}
