import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Calendar, Filter } from 'lucide-react'
import Select from 'react-select'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
}

interface DateRange {
  start: Date
  end: Date
}

interface FilterBarProps {
  // Quick filter presets
  quickFilters?: Array<{
    label: string
    value: string
    onClick: () => void
  }>
  
  // Subject filter
  subjects?: FilterOption[]
  selectedSubject?: string
  onSubjectChange?: (value: string) => void
  
  // Class filter
  classes?: FilterOption[]
  selectedClass?: string
  onClassChange?: (value: string) => void
  
  // Exam board filter
  examBoards?: FilterOption[]
  selectedExamBoard?: string
  onExamBoardChange?: (value: string) => void
  
  // Date range filter
  dateRange?: DateRange | null
  onDateRangeChange?: (range: DateRange | null) => void
  
  // Custom filters
  customFilters?: React.ReactNode
  
  // Clear all handler
  onClearAll?: () => void
  
  // Show/hide sections
  showQuickFilters?: boolean
  showSubject?: boolean
  showClass?: boolean
  showExamBoard?: boolean
  showDateRange?: boolean
}

export function FilterBar({
  quickFilters = [],
  subjects = [],
  selectedSubject = '',
  onSubjectChange,
  classes = [],
  selectedClass = '',
  onClassChange,
  examBoards = [],
  selectedExamBoard = '',
  onExamBoardChange,
  dateRange,
  onDateRangeChange,
  customFilters,
  onClearAll,
  showQuickFilters = true,
  showSubject = false,
  showClass = false,
  showExamBoard = false,
  showDateRange = false,
}: FilterBarProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const hasActiveFilters = 
    selectedSubject !== '' ||
    selectedClass !== '' ||
    selectedExamBoard !== '' ||
    dateRange !== null ||
    activeQuickFilter !== ''

  const handleQuickFilter = (filter: { label: string; value: string; onClick: () => void }) => {
    setActiveQuickFilter(filter.value)
    filter.onClick()
  }

  const handleDateRangeApply = () => {
    if (startDate && endDate && onDateRangeChange) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      onDateRangeChange({ start, end })
      setShowDatePicker(false)
    }
  }

  const handleDateRangeClear = () => {
    setStartDate('')
    setEndDate('')
    if (onDateRangeChange) {
      onDateRangeChange(null)
    }
    setShowDatePicker(false)
  }

  const handleClearAll = () => {
    setActiveQuickFilter('')
    setStartDate('')
    setEndDate('')
    if (onSubjectChange) onSubjectChange('')
    if (onClassChange) onClassChange('')
    if (onExamBoardChange) onExamBoardChange('')
    if (onDateRangeChange) onDateRangeChange(null)
    if (onClearAll) onClearAll()
  }

  return (
    <div className="w-full bg-card border rounded-lg p-4 mb-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="text-xs text-muted-foreground">
                ({[
                  selectedSubject && 'Subject',
                  selectedClass && 'Class',
                  selectedExamBoard && 'Exam Board',
                  dateRange && 'Date Range',
                  activeQuickFilter && 'Quick Filter'
                ].filter(Boolean).length} active)
              </span>
            )}
          </div>
          {hasActiveFilters && onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Quick Filter Chips */}
        {showQuickFilters && quickFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={activeQuickFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter(filter)}
                className="h-8 text-xs"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Filter */}
          {showSubject && subjects.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Select
                options={subjects}
                value={subjects.find((s) => s.value === selectedSubject) || null}
                onChange={(option) => onSubjectChange?.(option?.value || '')}
                isClearable
                placeholder="All Subjects"
                className="text-sm"
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '36px',
                    height: '36px',
                  }),
                }}
              />
            </div>
          )}

          {/* Class Filter */}
          {showClass && classes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Class</Label>
              <Select
                options={classes}
                value={classes.find((c) => c.value === selectedClass) || null}
                onChange={(option) => onClassChange?.(option?.value || '')}
                isClearable
                placeholder="All Classes"
                className="text-sm"
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '36px',
                    height: '36px',
                  }),
                }}
              />
            </div>
          )}

          {/* Exam Board Filter */}
          {showExamBoard && examBoards.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Exam Board</Label>
              <Select
                options={examBoards}
                value={examBoards.find((b) => b.value === selectedExamBoard) || null}
                onChange={(option) => onExamBoardChange?.(option?.value || '')}
                isClearable
                placeholder="All Exam Boards"
                className="text-sm"
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '36px',
                    height: '36px',
                  }),
                }}
              />
            </div>
          )}

          {/* Date Range Filter */}
          {showDateRange && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              {!showDatePicker ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDatePicker(true)}
                  className="w-full h-9 justify-start text-left font-normal"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateRange
                    ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                    : 'Select date range'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="start-date" className="text-xs">Start</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs">End</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleDateRangeApply}
                      disabled={!startDate || !endDate}
                      className="h-8 text-xs flex-1"
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDateRangeClear}
                      className="h-8 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Filters */}
          {customFilters}
        </div>
      </div>
    </div>
  )
}

