import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export interface InterventionDataPoint {
  student_id: string
  student_name: string
  student_email: string
  class_name?: string
  average_score: number
  time_spent_minutes: number
  total_attempts: number
}

export interface InterventionHeatMapProps {
  data: InterventionDataPoint[]
  onPointClick?: (point: InterventionDataPoint) => void
  scoreThreshold?: number // Default threshold for high/low score (e.g., 70)
  timeThreshold?: number // Default threshold for high/low time in minutes (e.g., 60)
}

const getQuadrantColor = (
  score: number,
  time: number,
  scoreThreshold: number,
  timeThreshold: number
): string => {
  const isHighScore = score >= scoreThreshold
  const isHighTime = time >= timeThreshold

  if (isHighScore && isHighTime) {
    return '#22c55e' // Green - Excellent
  } else if (!isHighScore && isHighTime) {
    return '#eab308' // Yellow - Struggling, needs help
  } else if (isHighScore && !isHighTime) {
    return '#3b82f6' // Blue - Gifted, may need challenge
  } else {
    return '#dc2626' // Red - At-risk, needs intervention
  }
}

const getQuadrantLabel = (
  score: number,
  time: number,
  scoreThreshold: number,
  timeThreshold: number
): string => {
  const isHighScore = score >= scoreThreshold
  const isHighTime = time >= timeThreshold

  if (isHighScore && isHighTime) {
    return 'Excellent'
  } else if (!isHighScore && isHighTime) {
    return 'Struggling'
  } else if (isHighScore && !isHighTime) {
    return 'Gifted'
  } else {
    return 'At-Risk'
  }
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm">
        <div className="font-semibold mb-1">{data.student_name}</div>
        <div className="text-xs mb-1">{data.student_email}</div>
        {data.class_name && <div className="text-xs mb-1">Class: {data.class_name}</div>}
        <div className="text-xs">Average Score: {data.average_score.toFixed(1)}%</div>
        <div className="text-xs">Time Spent: {formatTime(data.time_spent_minutes)}</div>
        <div className="text-xs">Attempts: {data.total_attempts}</div>
        <div className="text-xs mt-1 font-medium">
          Status: {getQuadrantLabel(data.average_score, data.time_spent_minutes, 70, 60)}
        </div>
      </div>
    )
  }
  return null
}

const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

export function InterventionHeatMap({
  data,
  onPointClick,
  scoreThreshold = 70,
  timeThreshold = 60,
}: InterventionHeatMapProps) {
  const chartData = data.map((point) => ({
    ...point,
    x: point.average_score,
    y: point.time_spent_minutes,
  }))

  const maxScore = Math.max(...data.map((d) => d.average_score), 100)
  const maxTime = Math.max(...data.map((d) => d.time_spent_minutes), 120)

  const handlePointClick = (data: any) => {
    if (onPointClick && data.payload) {
      onPointClick(data.payload)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intervention Heat Map</CardTitle>
        <CardDescription>
          Average Score vs Time Spent - Click points to view student details
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium">Quadrants:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span>Excellent (High Score, High Time)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span>Struggling (Low Score, High Time)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <span>Gifted (High Score, Low Time)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span>At-Risk (Low Score, Low Time)</span>
          </div>
        </div>

        {/* Scatter Plot */}
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart
            margin={{
              top: 20,
              right: 20,
              bottom: 60,
              left: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Average Score"
              label={{ value: 'Average Score (%)', position: 'insideBottom', offset: -5 }}
              domain={[0, Math.max(maxScore, 100)]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Time Spent"
              label={{ value: 'Time Spent (minutes)', angle: -90, position: 'insideLeft' }}
              domain={[0, Math.max(maxTime, 120)]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Scatter
              name="Students"
              data={chartData}
              fill="#8884d8"
              onClick={handlePointClick}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getQuadrantColor(
                    entry.average_score,
                    entry.time_spent_minutes,
                    scoreThreshold,
                    timeThreshold
                  )}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No data available for intervention analysis.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

