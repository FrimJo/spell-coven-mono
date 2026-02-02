import * as React from 'react'

import { cn } from '@repo/ui/lib/utils'

interface WorkOrderCardProps {
  status: string
  isSelected: boolean
  workOrderItem: unknown
  onClick: () => void
  children: React.ReactNode
}

export const WorkOrderCard = ({
  status: _status,
  isSelected,
  workOrderItem: _workOrderItem,
  onClick,
  children,
}: WorkOrderCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border transition-colors',
        isSelected && 'ring-primary ring-2',
      )}
    >
      <div className="bg-warning flex-1 p-4">{children}</div>
    </div>
  )
}
