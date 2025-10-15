import { CardResult } from '@repo/ui/components/card-result'
import { InlineMessage } from '@repo/ui/components/inline-message'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { isLowConfidence } from '@/types/card-query'

export function CardResultDisplay() {
  const { state } = useCardQueryContext()

  // Don't render anything in idle state
  if (state.status === 'idle') {
    return null
  }

  // Render loading state
  if (state.status === 'querying') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Identifying card...</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (state.status === 'error') {
    return (
      <InlineMessage
        variant="error"
        title="Card Identification Failed"
        message={state.error || 'Unknown error occurred'}
      />
    )
  }

  // Render success state
  if (state.status === 'success' && state.result) {
    const showLowConfidence = isLowConfidence(state.result.score)

    return (
      <CardResult
        result={state.result}
        showLowConfidenceWarning={showLowConfidence}
      />
    )
  }

  return null
}
