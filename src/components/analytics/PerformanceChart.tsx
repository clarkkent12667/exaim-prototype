import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PerformanceChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>
  type?: 'line' | 'bar'
  dataKey?: string
  title?: string
  color?: string
}

export function PerformanceChart({ 
  data, 
  type = 'line', 
  dataKey = 'value',
  title,
  color = '#8884d8'
}: PerformanceChartProps) {
  const ChartComponent = type === 'line' ? LineChart : BarChart
  const DataComponent = type === 'line' ? Line : Bar

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <DataComponent type="monotone" dataKey={dataKey} stroke={color} fill={color} />
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

