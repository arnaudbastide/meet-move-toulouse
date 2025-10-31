import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useRef,
  type HTMLAttributes,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';

const PanelGroupDirectionContext = createContext<'horizontal' | 'vertical'>('horizontal');

type PanelGroupProps = HTMLAttributes<HTMLDivElement> & {
  direction?: 'horizontal' | 'vertical';
};

const ResizablePanelGroup: React.FC<PanelGroupProps> = ({
  direction = 'horizontal',
  className,
  children,
  ...props
}) => {
  const value = useMemo(() => direction, [direction]);

  return (
    <PanelGroupDirectionContext.Provider value={value}>
      <div
        data-panel-group
        data-direction={direction}
        className={cn(
          'flex h-full w-full',
          direction === 'vertical' ? 'flex-col' : 'flex-row',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </PanelGroupDirectionContext.Provider>
  );
};

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
};

const ResizablePanel = forwardRef<HTMLDivElement, PanelProps>(
  (
    { defaultSize, minSize = 5, maxSize = 95, className, style, children, ...props },
    ref
  ) => {
    const direction = useContext(PanelGroupDirectionContext);
    const basis = defaultSize ?? null;

    return (
      <div
        data-panel=""
        data-min-size={minSize}
        data-max-size={maxSize}
        ref={ref}
        className={cn(
          'relative flex min-h-[10px] min-w-[10px] flex-1 overflow-hidden',
          direction === 'vertical' ? 'w-full' : 'h-full',
          className
        )}
        style={{
          ...style,
          flexBasis: basis != null ? `${basis}%` : style?.flexBasis,
          flexGrow: basis != null ? 0 : 1,
          flexShrink: 0,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResizablePanel.displayName = 'ResizablePanel';

type ResizeHandleProps = HTMLAttributes<HTMLDivElement> & {
  withHandle?: boolean;
};

const mergeRefs = <T,>(...refs: Array<Ref<T>>) => {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref && typeof ref === 'object') {
        (ref as MutableRefObject<T | null>).current = value;
      }
    }
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getSiblingPanel = (element: HTMLElement | null, direction: 'previous' | 'next') => {
  let sibling: Element | null = direction === 'previous' ? element?.previousElementSibling : element?.nextElementSibling;

  while (sibling) {
    if (sibling instanceof HTMLElement && 'panel' in sibling.dataset) {
      return sibling;
    }
    sibling = direction === 'previous' ? sibling.previousElementSibling : sibling.nextElementSibling;
  }

  return null;
};

const startResize = (
  event: ReactPointerEvent<HTMLDivElement>,
  handle: HTMLDivElement,
  direction: 'horizontal' | 'vertical'
) => {
  const group = handle.closest('[data-panel-group]') as HTMLElement | null;
  if (!group) return;

  const previousPanel = getSiblingPanel(handle, 'previous');
  const nextPanel = getSiblingPanel(handle, 'next');

  if (!previousPanel || !nextPanel) {
    return;
  }

  const pointerId = event.pointerId;
  handle.setPointerCapture(pointerId);

  const previousRect = previousPanel.getBoundingClientRect();
  const nextRect = nextPanel.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();

  const groupSize = direction === 'vertical' ? groupRect.height : groupRect.width;
  if (!groupSize) {
    return;
  }

  const startPosition = direction === 'vertical' ? event.clientY : event.clientX;
  const previousSize = direction === 'vertical' ? previousRect.height : previousRect.width;
  const nextSize = direction === 'vertical' ? nextRect.height : nextRect.width;

  const minPrevious = ((Number(previousPanel.dataset.minSize) || 5) / 100) * groupSize;
  const maxPrevious = ((Number(previousPanel.dataset.maxSize) || 95) / 100) * groupSize;
  const minNext = ((Number(nextPanel.dataset.minSize) || 5) / 100) * groupSize;
  const maxNext = ((Number(nextPanel.dataset.maxSize) || 95) / 100) * groupSize;

  const handlePointerMove = (moveEvent: PointerEvent) => {
    const currentPosition = direction === 'vertical' ? moveEvent.clientY : moveEvent.clientX;
    const delta = currentPosition - startPosition;

    let newPreviousSize = previousSize + delta;
    let newNextSize = nextSize - delta;

    newPreviousSize = clamp(newPreviousSize, minPrevious, maxPrevious);
    newNextSize = clamp(newNextSize, minNext, maxNext);

    if (newPreviousSize + newNextSize > groupSize) {
      const overflow = newPreviousSize + newNextSize - groupSize;
      if (delta > 0) {
        newNextSize = clamp(newNextSize - overflow, minNext, maxNext);
      } else {
        newPreviousSize = clamp(newPreviousSize - overflow, minPrevious, maxPrevious);
      }
    }

    const previousPercent = (newPreviousSize / groupSize) * 100;
    const nextPercent = (newNextSize / groupSize) * 100;

    previousPanel.style.flexBasis = `${previousPercent}%`;
    previousPanel.style.flexGrow = '0';
    nextPanel.style.flexBasis = `${nextPercent}%`;
    nextPanel.style.flexGrow = '0';
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);

    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
};

const ResizableHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ withHandle, className, children, onPointerDown, ...props }, ref) => {
    const direction = useContext(PanelGroupDirectionContext);
    const localRef = useRef<HTMLDivElement>(null);

    return (
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={direction}
        data-panel-resize-handle=""
        ref={mergeRefs(ref, localRef)}
        className={cn(
          'relative flex items-center justify-center bg-border',
          direction === 'vertical'
            ? 'h-px w-full cursor-row-resize'
            : 'h-full w-px cursor-col-resize',
          'after:absolute after:bg-border after:content-[""]',
          direction === 'vertical'
            ? 'after:left-0 after:top-1/2 after:h-1 after:w-full after:-translate-y-1/2'
            : 'after:left-1/2 after:top-0 after:h-full after:w-1 after:-translate-x-1/2',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
          className
        )}
        onPointerDown={(event) => {
          const element = localRef.current;
          if (element) {
            startResize(event, element, direction);
          }
          onPointerDown?.(event);
        }}
        {...props}
      >
        {withHandle ? (
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);
ResizableHandle.displayName = 'ResizableHandle';

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
