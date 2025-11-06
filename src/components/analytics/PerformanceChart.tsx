import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface PerformanceChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>
  type?: 'line' | 'bar' | 'area'
  dataKey?: string
  title?: string
  color?: string
  showArea?: boolean
  showTarget?: number
  height?: number
  className?: string
}

export function PerformanceChart({ 
  data, 
  type = 'line', 
  dataKey = 'value',
  title,
  color = '#8884d8',
  showArea = false,
  showTarget,
  height = 300,
  className
}: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className={cn("w-full flex items-center justify-center", className)} style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  const ChartComponent = type === 'line' 
    ? (showArea ? AreaChart : LineChart)
    : BarChart

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name || 'Value'}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className={cn("w-full", className)}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Tooltip content={customTooltip} />
          {type === 'line' && showArea ? (
            <>
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={`url(#gradient-${color.replace('#', '')})`}
                strokeWidth={2}
              />
              {showTarget !== undefined && (
                <Line
                  type="monotone"
                  dataKey={() => showTarget}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Target"
                />
              )}
            </>
          ) : type === 'line' ? (
            <>
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, r: 4 }}
                activeDot={{ r: 6 }}
              />
              {showTarget !== undefined && (
                <Line
                  type="monotone"
                  dataKey={() => showTarget}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Target"
                />
              )}
            </>
          ) : (
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
            />
          )}
          <Legend />
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

