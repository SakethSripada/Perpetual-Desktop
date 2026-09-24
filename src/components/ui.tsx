import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import { X, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
export const cn = (...args: ClassValue[]) => twMerge(clsx(args));
export function Button({
  className,
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'solid' | 'outline' }) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        variant === 'solid'
          ? 'bg-ink text-surface hover:opacity-85'
          : variant === 'outline'
            ? 'border border-line bg-elevated hover:bg-hover'
            : 'text-muted hover:bg-hover hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button aria-label={label} className="h-8 w-8 p-0" {...props}>
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs text-ink shadow-xl"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        className="w-full appearance-none rounded-lg border border-line bg-elevated py-2 pl-3 pr-8 text-[13px] text-ink outline-none focus:border-accent disabled:opacity-40"
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-muted" />
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-8 py-4">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && (
          <span className="mt-1 block max-w-lg text-[13px] leading-relaxed text-muted">
            {description}
          </span>
        )}
      </span>
      <Switch.Root
        aria-label={label}
        disabled={disabled}
        checked={checked}
        onCheckedChange={onChange}
        className="h-[22px] w-10 shrink-0 rounded-full bg-line p-[3px] transition-colors data-[state=checked]:bg-accent disabled:opacity-40"
      >
        <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </label>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(560px,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-7 text-ink shadow-2xl">
          <Dialog.Title className="pr-8 text-xl font-semibold tracking-tight">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </Dialog.Description>
          <Dialog.Close asChild>
            <button
              aria-label="Close dialog"
              className="absolute right-5 top-5 rounded-md p-1 text-muted hover:bg-hover"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 rounded-2xl border border-line bg-elevated p-4 text-muted">{icon}</div>
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <div className="mt-2 max-w-md text-sm leading-6 text-muted">{children}</div>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-9 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.035em]">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {actions}
    </div>
  );
}
export function ProviderLogo({ agent, size = 20 }: { agent: string; size?: number }) {
  return (
    <img
      src={`/brands/${agent === 'codex' ? 'openai' : 'claude'}.svg`}
      alt={agent === 'codex' ? 'OpenAI' : 'Claude'}
      width={size}
      height={size}
      className="shrink-0 object-contain"
    />
  );
}

export function PerpetualMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M32 12v40M17 22l15 14 15-14M14 49l18-17 18 17"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="12" r="6" fill="currentColor" />
      <circle cx="32" cy="34" r="7" fill="currentColor" />
      <circle cx="14" cy="49" r="6" fill="currentColor" />
      <circle cx="50" cy="49" r="6" fill="currentColor" />
    </svg>
  );
}
