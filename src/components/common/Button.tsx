import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)] border border-transparent hover:brightness-95 active:brightness-90',
  secondary: 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--line-strong)]',
  ghost: 'bg-transparent text-[var(--ink-2)] border border-transparent hover:bg-[var(--surface-2)]',
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

const SPINNER_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4.5 w-4.5',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={[
        'relative inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium',
        'transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className={isLoading ? 'invisible inline-flex items-center gap-2' : 'inline-flex items-center gap-2'}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span
            className={`${SPINNER_SIZE[size]} rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none`}
          />
        </span>
      )}
      {isLoading && <span className="sr-only" role="status">Loading</span>}
    </button>
  )
}
