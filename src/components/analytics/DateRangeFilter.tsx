import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

interface DateRangeFilterProps {
  onFilterChange: (range: { start: Date; end: Date } | null) => void
}

export function DateRangeFilter({ onFilterChange }: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(false)

  const handleApply = () => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // End of day
      onFilterChange({ start, end })
      setIsActive(true)
    }
  }

  const handleClear = () => {
    setStartDate('')
    setEndDate('')
    onFilterChange(null)
    setIsActive(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Date Range Filter
        </CardTitle>
        <CardDescription>Filter analytics by date range</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApply} disabled={!startDate || !endDate}>
              Apply
            </Button>
            {isActive && (
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

