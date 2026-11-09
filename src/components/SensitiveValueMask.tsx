import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

interface SensitiveValueMaskProps {
  isAuthorized: boolean;
  value?: React.ReactNode;
  maskText?: string;
  className?: string;
  showLockIcon?: boolean;
  badgeMode?: boolean;
  requiredRole?: string;
}

export const SensitiveValueMask: React.FC<SensitiveValueMaskProps> = ({
  isAuthorized,
  value,
  maskText = '••••••',
  className = '',
  showLockIcon = true,
  badgeMode = false,
  requiredRole = 'manager'
}) => {
  const { tText } = useLanguage();

  if (isAuthorized) {
    return <span className={className}>{value}</span>;
  }

  if (badgeMode) {
    return (
      <span
        title={tText('Restricted: Manager or Admin Access Required', 'प्रतिबंधित: केवल प्रबंधक या व्यवस्थापक पहुंच')}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-[11px] font-medium text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed select-none",
          className
        )}
      >
        <Lock size={11} className="text-amber-500 shrink-0" />
        <span>{maskText}</span>
      </span>
    );
  }

  return (
    <span
      title={tText('Restricted: Manager or Admin Access Required', 'प्रतिबंधित: केवल प्रबंधक या व्यवस्थापक पहुंच')}
      className={cn(
        "inline-flex items-center gap-1 font-mono tracking-widest text-slate-400 dark:text-slate-500 cursor-not-allowed select-none",
        className
      )}
    >
      {showLockIcon && <Lock size={12} className="text-amber-500/80 shrink-0" />}
      <span>{maskText}</span>
    </span>
  );
};

export default SensitiveValueMask;
