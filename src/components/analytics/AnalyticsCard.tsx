import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnalyticsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  progress?: number // 0-100 for progress bar
  variant?: 'default' | 'success' | 'warning' | 'danger'
  iconBg?: string // Custom background color for icon
}

export function AnalyticsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  progress,
  variant = 'default',
  iconBg
}: AnalyticsCardProps) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-green-200 dark:border-green-800',
    warning: 'border-yellow-200 dark:border-yellow-800',
    danger: 'border-red-200 dark:border-red-800',
  }

  const iconBgColors = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  }

  const iconBgClass = iconBg || iconBgColors[variant]

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-md", variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", iconBgClass)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-2">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            {trend.value > 0 ? (
              <TrendingUp className={cn("h-4 w-4", trend.isPositive ? "text-green-600" : "text-red-600")} />
            ) : trend.value < 0 ? (
              <TrendingDown className={cn("h-4 w-4", trend.isPositive ? "text-green-600" : "text-red-600")} />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% from last period
            </span>
          </div>
        )}
        {progress !== undefined && (
          <div className="mt-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  variant === 'success' ? "bg-green-500" :
                  variant === 'warning' ? "bg-yellow-500" :
                  variant === 'danger' ? "bg-red-500" :
                  "bg-primary"
                )}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(0)}%</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

