import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number // 0-100
  title?: string
  description?: string
  target?: number // Target score
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  className?: string
}

export function ScoreGauge({
  score,
  title,
  description,
  target,
  size = 'md',
  showValue = true,
  className,
}: ScoreGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, score))
  const clampedTarget = target ? Math.min(100, Math.max(0, target)) : null

  const sizeConfig = {
    sm: { size: 128, radius: 56, strokeWidth: 8 },
    md: { size: 160, radius: 70, strokeWidth: 10 },
    lg: { size: 192, radius: 84, strokeWidth: 12 },
  }

  const config = sizeConfig[size]
  const circumference = 2 * Math.PI * config.radius
  const offset = circumference - (clampedScore / 100) * circumference
  const targetOffset = clampedTarget
    ? circumference - (clampedTarget / 100) * circumference
    : null

  const getColor = (value: number) => {
    if (value >= 80) return 'text-green-500'
    if (value >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getStrokeColor = (value: number) => {
    if (value >= 80) return 'stroke-green-500'
    if (value >= 60) return 'stroke-yellow-500'
    return 'stroke-red-500'
  }

  return (
    <Card className={cn("", className)}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs">{description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="relative" style={{ width: config.size, height: config.size }}>
          <svg
            className="transform -rotate-90"
            width={config.size}
            height={config.size}
          >
            {/* Background circle */}
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={config.radius}
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
              fill="none"
              className="text-muted opacity-20"
            />
            {/* Target line (if provided) */}
            {targetOffset !== null && (
              <circle
                cx={config.size / 2}
                cy={config.size / 2}
                r={config.radius}
                stroke="currentColor"
                strokeWidth={config.strokeWidth * 0.5}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={targetOffset}
                className="text-blue-500 opacity-50"
                strokeLinecap="round"
              />
            )}
            {/* Score circle */}
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={config.radius}
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-1000 ease-out",
                getStrokeColor(clampedScore)
              )}
              strokeLinecap="round"
            />
          </svg>
          {showValue && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", getColor(clampedScore))}>
                {clampedScore.toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
              {clampedTarget && (
                <span className="text-xs text-blue-500 mt-1">
                  Target: {clampedTarget.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

