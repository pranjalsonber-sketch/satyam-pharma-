import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';

interface SortableDashboardWidgetProps {
  id: string;
  title?: string;
  className?: string;
  children: React.ReactNode;
  isOverlay?: boolean;
}

export function SortableDashboardWidget({
  id,
  title,
  className,
  children,
  isOverlay = false,
}: SortableDashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const content = (
    <div
      className={cn(
        "relative rounded-2xl transition-all",
        isOverlay && "ring-2 ring-blue-500 shadow-2xl scale-[1.01] bg-white/95 dark:bg-slate-900/95 cursor-grabbing z-50",
        isDragging && "opacity-40 border-2 border-dashed border-blue-400 dark:border-blue-500",
        className
      )}
    >
      {/* Draggable header badge handle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity">
        <button
          type="button"
          aria-label={`Drag to reorder ${title || id} section`}
          {...attributes}
          {...listeners}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white backdrop-blur-xs cursor-grab active:cursor-grabbing hover:shadow-xs transition-all"
          title={`Drag to reorder section (${title || id})`}
        >
          <GripVertical size={14} />
        </button>
      </div>

      {children}
    </div>
  );

  if (isOverlay) {
    return content;
  }

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      {content}
    </div>
  );
}
