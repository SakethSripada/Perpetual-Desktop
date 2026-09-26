import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import { X, ChevronDown, Check, ChevronRight, LoaderCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, SelectHTMLAttributes } from 'react';
import type { Tone } from '../lib/format';

export const cn = (...args: ClassValue[]) => twMerge(clsx(args));

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  className,
  variant = 'ghost',
  size = 'md',
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-ink text-surface hover:bg-ink/85',
        variant === 'secondary' && 'border border-line bg-elevated text-ink hover:bg-hover',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-ink',
        variant === 'danger' && 'bg-danger text-white hover:bg-danger/85',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Tip({
  label,
  children,
  side = 'bottom',
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-64 animate-fade-in rounded-md border border-line bg-elevated px-2 py-1 text-xs text-ink shadow-lg"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function IconButton({
  label,
  children,
  className,
  side,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tip label={label} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tip>
  );
}

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        className="h-8 w-full appearance-none rounded-lg border border-line bg-elevated pr-8 pl-3 text-[13px] text-ink outline-none transition-colors hover:bg-hover focus-visible:border-muted disabled:opacity-45"
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-muted" />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Switch.Root
      aria-label={label}
      disabled={disabled}
      checked={checked}
      onCheckedChange={onChange}
      className="h-5 w-9 shrink-0 rounded-full bg-line p-0.5 transition-colors data-[state=checked]:bg-accent disabled:opacity-45"
    >
      <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" />
    </Switch.Root>
  );
}

/** A settings row: label and optional help on the left, a control on the right. */
export function Row({
  label,
  description,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-6 py-3.5', className)}>
      <div className="min-w-0">
        <div className="text-[13px] text-ink">{label}</div>
        {description && <div className="mt-0.5 text-xs leading-5 text-muted">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row label={label} description={description}>
      <Toggle label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </Row>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-xl border border-line bg-elevated/40', className)} {...props} />
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/50" />
        <Dialog.Content
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 animate-pop-in flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl outline-none"
        >
          <div className="px-6 pt-5 pb-1">
            <Dialog.Title className="pr-8 text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Description
              className={cn('text-[13px] leading-5 text-muted', description && 'mt-1.5')}
            >
              {description}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="absolute top-4 right-4 rounded-md p-1 text-muted hover:bg-hover hover:text-ink"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 overflow-y-auto px-6 pt-4 pb-5">{children}</div>}
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line/70 px-6 py-3.5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 text-faint">{icon}</div>}
      <h2 className="text-[15px] font-medium">{title}</h2>
      {children && (
        <div className="mt-1.5 max-w-sm text-[13px] leading-5 text-muted">{children}</div>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 max-w-xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const toneText: Record<Tone, string> = {
  neutral: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
const toneBg: Record<Tone, string> = {
  neutral: 'bg-faint',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function Dot({ tone = 'neutral', live }: { tone?: Tone; live?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {live && (
        <span
          className={cn('absolute inset-0 animate-ping rounded-full opacity-60', toneBg[tone])}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', toneBg[tone])} />
    </span>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' ? 'bg-hover text-muted' : 'bg-current/10',
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line px-1 font-sans text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}

export function ProviderLogo({ agent, size = 18 }: { agent: string; size?: number }) {
  if (agent === 'codex')
    return (
      <span
        role="img"
        aria-label="OpenAI"
        className="inline-block shrink-0 bg-ink"
        style={{
          width: size,
          height: size,
          maskImage: 'url(/brands/openai.svg)',
          WebkitMaskImage: 'url(/brands/openai.svg)',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
        }}
      />
    );
  return (
    <img
      src="/brands/claude.svg"
      alt="Claude"
      width={size}
      height={size}
      draggable={false}
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

// ---- Menus -----------------------------------------------------------------

const menuSurface =
  'z-[60] min-w-52 animate-pop-in rounded-xl border border-line bg-elevated p-1 text-[13px] text-ink shadow-xl outline-none';
const menuItem =
  'relative flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-45 data-[highlighted]:bg-hover';

export const MenuRoot = Menu.Root;
export const MenuTrigger = Menu.Trigger;
export const MenuRadioGroup = Menu.RadioGroup;
export const MenuSub = Menu.Sub;

export function MenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        collisionPadding={12}
        className={cn(menuSurface, className)}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  ...props
}: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return <Menu.Item className={cn(menuItem, danger && 'text-danger', className)} {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(menuItem, 'pr-8', className)} {...props}>
      {children}
      <Menu.ItemIndicator className="absolute right-2.5">
        <Check size={14} />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(menuItem, 'pr-8', className)} {...props}>
      {children}
      <Menu.ItemIndicator className="absolute right-2.5">
        <Check size={14} />
      </Menu.ItemIndicator>
    </Menu.CheckboxItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('px-2.5 pt-2 pb-1 text-[11px] font-medium text-faint', className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="-mx-1 my-1 h-px bg-line/70" />;
}

export function MenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.SubTrigger>) {
  return (
    <Menu.SubTrigger
      className={cn(menuItem, 'pr-7 data-[state=open]:bg-hover', className)}
      {...props}
    >
      {children}
      <ChevronRight size={14} className="absolute right-2 text-muted" />
    </Menu.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof Menu.SubContent>) {
  return (
    <Menu.Portal>
      <Menu.SubContent
        sideOffset={4}
        collisionPadding={12}
        className={cn(menuSurface, 'max-h-80 overflow-y-auto', className)}
        {...props}
      />
    </Menu.Portal>
  );
}
