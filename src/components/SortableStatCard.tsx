import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export interface StatCardData {
  id: string;
  label: string;
  subtitle: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color: string;
  trend: string;
  isUp: boolean;
  onClick?: () => void;
}

interface SortableStatCardProps {
  card: StatCardData;
  index: number;
  isOverlay?: boolean;
}

export function SortableStatCard({ card, index, isOverlay = false }: SortableStatCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const IconComponent = card.icon;

  const content = (
    <motion.div
      id={`dashboard-stat-card-${card.id}`}
      whileHover={!isDragging && !isOverlay ? { scale: 1.025, y: -3 } : undefined}
      whileTap={!isDragging && !isOverlay ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => {
        if (!isDragging && card.onClick) {
          card.onClick();
        }
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow dark:bg-slate-900 select-none",
        card.onClick && !isDragging && "cursor-pointer",
        isOverlay 
          ? "border-blue-500 shadow-2xl scale-105 rotate-1 bg-white/95 dark:bg-slate-900/95 ring-2 ring-blue-400 cursor-grabbing" 
          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 hover:shadow-md",
        isDragging && "border-dashed border-blue-400 bg-blue-50/20 dark:bg-blue-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5 text-white shadow-md flex items-center justify-center transition-transform group-hover:scale-105", card.color)}>
            <IconComponent size={20} />
          </div>
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight",
            card.isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {card.trend}
            {card.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </div>
        </div>

        {/* Drag Handle */}
        <button
          type="button"
          aria-label={`Drag ${card.label} card to reorder`}
          {...attributes}
          {...listeners}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          title="Drag to prioritize widget"
        >
          <GripVertical size={16} />
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</h3>
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">{card.value}</p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">{card.subtitle}</p>
      </div>

      {/* Subtle bottom indicator */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
        card.color
      )} />
    </motion.div>
  );

  if (isOverlay) {
    return content;
  }

  return (
    <div ref={setNodeRef} style={style} className="h-full touch-none">
      {content}
    </div>
  );
}
