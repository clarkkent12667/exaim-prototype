import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('should handle conditional classes', () => {
      const result = cn('class1', false && 'class2', 'class3')
      expect(result).toContain('class1')
      expect(result).toContain('class3')
      expect(result).not.toContain('class2')
    })

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('should merge Tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4')
      // The later class should override the earlier one
      expect(result).toContain('px-4')
      expect(result).not.toContain('px-2')
    })

    it('should handle empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
      expect(result).toContain('class3')
    })

    it('should handle objects', () => {
      const result = cn({ class1: true, class2: false, class3: true })
      expect(result).toContain('class1')
      expect(result).toContain('class3')
      expect(result).not.toContain('class2')
    })
  })
})

