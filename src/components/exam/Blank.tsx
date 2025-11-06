import React from 'react'

interface BlankProps {
  answerLength?: number
  value?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
}

export function Blank({ answerLength, value = '', onChange, readOnly = false, className = '' }: BlankProps) {
  // Calculate width based on answer length, with clamped min/max
  // Default to 8ch if no answer length provided
  const length = answerLength || value.length || 8
  // Use clamp with ch units: min 4ch, preferred length+2ch, max 20ch
  const preferredWidth = Math.max(4, length + 2)
  const width = `clamp(4ch, ${preferredWidth}ch, 20ch)`

  const baseClassName = 'bg-yellow-100 border-2 border-yellow-600 rounded-md px-2 py-1 text-sm text-yellow-900 font-medium'
  const combinedClassName = `${baseClassName} ${className}`.trim()

  const style: React.CSSProperties = {
    display: 'inline-block',
    verticalAlign: 'baseline',
    width: width,
    minWidth: 0,
    maxWidth: '20ch',
    boxSizing: 'border-box',
    borderWidth: '2px',
  }

  if (readOnly) {
    return (
      <input
        type="text"
        readOnly
        value={value}
        className={combinedClassName}
        style={style}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={combinedClassName}
      style={style}
    />
  )
}
