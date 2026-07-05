import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Button ───────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/20',
      secondary: 'bg-[#1a1c24] text-zinc-100 hover:bg-[#1e2028] active:bg-[#252833] border border-[#252833]',
      outline: 'border border-[#303444] text-zinc-300 hover:bg-[#1a1c24] hover:border-[#3f4557] active:bg-[#1e2028]',
      ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1c24] active:bg-[#1e2028]',
      danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-lg shadow-red-600/20',
      gold: 'bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600 shadow-lg shadow-amber-500/20 font-semibold',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-lg gap-2',
      lg: 'h-12 px-6 text-base rounded-xl gap-2',
      icon: 'h-9 w-9 rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#08090c]',
          'disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ─── Card ─────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card = ({ className, children, glow, ...props }: CardProps) => (
  <div
    className={cn(
      'rounded-2xl border border-[#1c1e27] bg-[#0e0f14] overflow-hidden',
      glow && 'glow-blue',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ─── Input ────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[#252833] bg-[#0e0f14] px-3 py-2',
        'text-sm text-zinc-100 placeholder:text-zinc-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all duration-150',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// ─── Textarea ─────────────────────────────────────────────────
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full rounded-lg border border-[#252833] bg-[#0e0f14] px-3 py-2',
        'text-sm text-zinc-100 placeholder:text-zinc-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500/50',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        'transition-all duration-150',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

// ─── Badge ────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

export const Badge = ({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-[#1a1c24] text-zinc-400 border border-[#252833]',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger:  'bg-red-500/10 text-red-400 border border-red-500/20',
    info:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    gold:    'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

// ─── Modal ────────────────────────────────────────────────────
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[90vh] flex flex-col z-10',
          'rounded-2xl border border-[#252833] bg-[#0e0f14] shadow-2xl',
          'animate-fade-in-up',
          className
        )}
      >
        <div className="p-6 border-b border-[#1c1e27] flex justify-between items-center shrink-0">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-[#1a1c24] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── Table ────────────────────────────────────────────────────
export const Table = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('w-full overflow-x-auto', className)}>
    <table className="w-full text-left border-collapse">{children}</table>
  </div>
);

export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn('px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#1c1e27] bg-[#0a0b0f]', className)}>
    {children}
  </th>
);

export const Td = ({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) => (
  <td
    colSpan={colSpan}
    className={cn('px-4 py-3.5 text-sm text-zinc-300 border-b border-[#1c1e27]/60', className)}
  >
    {children}
  </td>
);

// ─── Tabs ─────────────────────────────────────────────────────
interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => (
  <div className={cn('flex gap-1 p-1 bg-[#0e0f14] rounded-xl border border-[#1c1e27] w-fit', className)}>
    {tabs.map((tab) => {
      const Icon = tab.icon;
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
            isActive
              ? 'bg-[#1a1c24] text-white shadow-sm border border-[#252833]'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#13141a]'
          )}
        >
          {Icon && <Icon size={15} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
              isActive ? 'bg-blue-600 text-white' : 'bg-[#1c1e27] text-zinc-500'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
    <div className="w-16 h-16 rounded-2xl bg-[#1a1c24] border border-[#252833] flex items-center justify-center mb-4">
      <Icon size={28} className="text-zinc-600" />
    </div>
    <h3 className="text-base font-semibold text-zinc-300 mb-1">{title}</h3>
    {description && <p className="text-sm text-zinc-600 max-w-xs mb-4">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

// ─── PageHeader ───────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  iconColor?: string;
  actions?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, icon: Icon, iconColor = 'text-blue-400', actions }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-fade-in-up">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-[#1a1c24] border border-[#252833] flex items-center justify-center shrink-0">
          <Icon size={20} className={iconColor} />
        </div>
      )}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </div>
);

// ─── StatCard ─────────────────────────────────────────────────
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
}

export const StatCard = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBg = 'bg-blue-500/10',
  trend,
  trendLabel,
  subtitle,
}: StatCardProps) => {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <Card className="p-5 hover:border-[#252833] transition-colors group">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            isPositive ? 'text-emerald-400 bg-emerald-500/10' :
            isNegative ? 'text-red-400 bg-red-500/10' :
            'text-zinc-500 bg-[#1a1c24]'
          )}>
            {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
        {(trendLabel || subtitle) && (
          <p className="text-xs text-zinc-600 mt-1">{trendLabel || subtitle}</p>
        )}
      </div>
    </Card>
  );
};

// ─── Toast Display Component ──────────────────────────────────
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X as XIcon } from 'lucide-react';
import { useToast, type Toast as ToastType } from '../../context/ToastContext';

const TOAST_ICONS: Record<'success' | 'error' | 'warning' | 'info', React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<'success' | 'error' | 'warning' | 'info', string> = {
  success: 'border-emerald-500/30 bg-[#0a1a0f]',
  error:   'border-red-500/30 bg-[#1a0808]',
  warning: 'border-amber-500/30 bg-[#1a1200]',
  info:    'border-blue-500/30 bg-[#080f1a]',
};

const TOAST_ICON_COLORS: Record<'success' | 'error' | 'warning' | 'info', string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  warning: 'text-amber-400',
  info:    'text-blue-400',
};

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const { removeToast } = useToast();
  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-xl min-w-[300px] max-w-sm w-full',
        'animate-slide-in-right',
        TOAST_STYLES[toast.type]
      )}
    >
      <Icon size={18} className={cn('shrink-0 mt-0.5', TOAST_ICON_COLORS[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.message && <p className="text-xs text-zinc-400 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 text-zinc-600 hover:text-zinc-300 rounded transition-colors shrink-0"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((toast: ToastType) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

