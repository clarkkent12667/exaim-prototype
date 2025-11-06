import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, XCircle } from 'lucide-react'

interface QuestionNavigationProps {
  totalQuestions: number
  currentIndex: number
  answeredQuestions: Set<number>
  onNavigate: (index: number) => void
}

export function QuestionNavigation({
  totalQuestions,
  currentIndex,
  answeredQuestions,
  onNavigate,
}: QuestionNavigationProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4">Question Navigation</h3>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: totalQuestions }).map((_, index) => {
            const isAnswered = answeredQuestions.has(index)
            const isCurrent = currentIndex === index

            return (
              <Button
                key={index}
                variant={isCurrent ? 'default' : isAnswered ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => onNavigate(index)}
                className="relative"
              >
                {index + 1}
                {isAnswered && (
                  <CheckCircle2 className="absolute -top-1 -right-1 h-3 w-3 text-green-600" />
                )}
              </Button>
            )
          })}
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4" />
            <span>Not answered</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Answered</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

