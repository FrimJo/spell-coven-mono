import {
  CommanderDamageDialogProvider,
  useCommanderDamageDialog,
} from '@/contexts/CommanderDamageDialogContext'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function DialogStateHarness() {
  const dialog = useCommanderDamageDialog()
  if (!dialog) throw new Error('Commander damage dialog provider is missing')

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.setOpenForPlayerId('player-two')}
      >
        Open player two
      </button>
      <output aria-label="Player one dialog">
        {String(dialog.openForPlayerId === 'player-one')}
      </output>
      <output aria-label="Player two dialog">
        {String(dialog.openForPlayerId === 'player-two')}
      </output>
    </>
  )
}

describe('CommanderDamageDialogContext', () => {
  it('opens only the requested player dialog from shared state', () => {
    render(
      <CommanderDamageDialogProvider>
        <DialogStateHarness />
      </CommanderDamageDialogProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open player two' }))

    expect(screen.getByLabelText('Player one dialog').textContent).toBe('false')
    expect(screen.getByLabelText('Player two dialog').textContent).toBe('true')
  })
})
