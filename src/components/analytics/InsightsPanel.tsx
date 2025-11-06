import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb, TrendingUp, AlertCircle, Target, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Insight {
  type: 'success' | 'warning' | 'info' | 'recommendation'
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface InsightsPanelProps {
  insights: Insight[]
  title?: string
  description?: string
  className?: string
}

export function InsightsPanel({
  insights,
  title = 'Insights & Recommendations',
  description,
  className,
}: InsightsPanelProps) {
  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return CheckCircle2
      case 'warning':
        return AlertCircle
      case 'info':
        return Lightbulb
      case 'recommendation':
        return Target
      default:
        return Lightbulb
    }
  }

  const getIconColor = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'info':
        return 'text-blue-600 dark:text-blue-400'
      case 'recommendation':
        return 'text-purple-600 dark:text-purple-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const getBgColor = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
      case 'recommendation':
        return 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
      default:
        return 'bg-muted border-border'
    }
  }

  if (insights.length === 0) {
    return null
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = getIcon(insight.type)
            return (
              <div
                key={index}
                className={cn(
                  "rounded-lg border p-4 transition-all hover:shadow-sm",
                  getBgColor(insight.type)
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", getIconColor(insight.type))} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                    {insight.action && (
                      <button
                        onClick={insight.action.onClick}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        {insight.action.label}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

