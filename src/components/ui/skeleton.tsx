import { cn } from '@/lib/utils'

/**
 * Skeleton component for loading states
 * Provides better perceived performance than plain "Loading..." text
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

