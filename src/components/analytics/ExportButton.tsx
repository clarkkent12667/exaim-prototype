import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface ExportButtonProps {
  onExportPDF: () => void
  onExportCSV: () => void
  label?: string
}

export function ExportButton({ onExportPDF, onExportCSV, label = 'Export' }: ExportButtonProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onExportPDF}>
        <Download className="h-4 w-4 mr-2" />
        {label} PDF
      </Button>
      <Button variant="outline" onClick={onExportCSV}>
        <Download className="h-4 w-4 mr-2" />
        {label} CSV
      </Button>
    </div>
  )
}

