import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils'

interface ComparisonDataPoint {
  name: string
  current: number
  previous: number
  label?: string
}

interface ComparisonChartProps {
  data: ComparisonDataPoint[]
  title?: string
  description?: string
  currentLabel?: string
  previousLabel?: string
  currentColor?: string
  previousColor?: string
  height?: number
  className?: string
}

export function ComparisonChart({
  data,
  title,
  description,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  currentColor = '#8884d8',
  previousColor = '#82ca9d',
  height = 300,
  className,
}: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar
              dataKey="current"
              name={currentLabel}
              fill={currentColor}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="previous"
              name={previousLabel}
              fill={previousColor}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

