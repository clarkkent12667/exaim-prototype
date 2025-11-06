import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ExamTimerProps {
  timeLimitMinutes: number
  startedAt: Date
  onTimeUp: () => void
}

export function ExamTimer({ timeLimitMinutes, startedAt, onTimeUp }: ExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(timeLimitMinutes * 60 * 1000)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt.getTime()
      const remaining = timeLimitMinutes * 60 * 1000 - elapsed
      
      if (remaining <= 0) {
        setTimeRemaining(0)
        onTimeUp()
        clearInterval(interval)
      } else {
        setTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLimitMinutes, startedAt, onTimeUp])

  const minutes = Math.floor(timeRemaining / 60000)
  const seconds = Math.floor((timeRemaining % 60000) / 1000)
  const isLowTime = timeRemaining < 5 * 60 * 1000 // Less than 5 minutes

  return (
    <Card className={isLowTime ? 'border-red-500 bg-red-50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Clock className={`h-5 w-5 ${isLowTime ? 'text-red-600' : ''}`} />
          <span className={`text-lg font-bold ${isLowTime ? 'text-red-600' : ''}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

