import React, { useEffect } from 'react'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
}

// Tailwind's arbitrary `animate-[...]` utility only sets the `animation`
// property - the @keyframes it references still has to exist somewhere.
// Components here can't touch src/styles/index.css, so the keyframes are
// injected once as a tiny stylesheet the first time a Skeleton renders.
const SHIMMER_STYLE_ID = 'bb-skeleton-shimmer-keyframes'

function ensureShimmerKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SHIMMER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SHIMMER_STYLE_ID
  style.textContent = `@keyframes bb-skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`
  document.head.appendChild(style)
}

const SHAPE_CLASSES: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text: 'rounded-md',
  circular: 'rounded-full',
  rectangular: 'rounded-[var(--radius-sm)]',
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'text',
  className = '',
}) => {
  useEffect(() => {
    ensureShimmerKeyframes()
  }, [])

  const isCircular = variant === 'circular'
  const circularSize = height ?? width ?? 40

  const style: React.CSSProperties = isCircular
    ? { width: circularSize, height: circularSize }
    : {
        width: width ?? '100%',
        height: height ?? (variant === 'text' ? '1em' : 80),
      }

  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      className={[
        'inline-block bg-gradient-to-r from-[var(--surface-2)] via-[var(--line)] to-[var(--surface-2)]',
        'bg-[length:200%_100%] animate-[bb-skeleton-shimmer_1.6s_ease-in-out_infinite] motion-reduce:animate-none',
        SHAPE_CLASSES[variant],
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    />
  )
}
