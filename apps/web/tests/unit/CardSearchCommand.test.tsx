import { CardSearchCommand } from '@/components/CardSearchCommand'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  searchCards: vi.fn(),
  setResult: vi.fn(),
}))

vi.mock('@/contexts/CardQueryContext', () => ({
  useCardQueryContext: () => ({ setResult: mocks.setResult }),
}))

vi.mock('@/lib/scryfall', () => ({
  searchCards: mocks.searchCards,
}))

vi.mock('@repo/ui/components/command', () => ({
  CommandDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close search
        </button>
        {children}
      </div>
    ) : null,
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value: string
    onValueChange: (value: string) => void
    placeholder: string
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode
    onSelect: () => void
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}))

const card = (id: string, name: string) => ({
  id,
  name,
  set: 'tst',
  set_name: 'Test Set',
  scryfall_uri: `https://scryfall.com/card/${id}`,
})

describe('CardSearchCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resets its query when closed and reopened', () => {
    const onOpenChange = vi.fn()
    const view = render(<CardSearchCommand open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByPlaceholderText('Search cards...'), {
      target: { value: 'sol' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)

    view.rerender(<CardSearchCommand open onOpenChange={onOpenChange} />)
    expect(
      (screen.getByPlaceholderText('Search cards...') as HTMLInputElement)
        .value,
    ).toBe('')
  })

  it('ignores results from an older search request', async () => {
    let resolveFirst: (value: ReturnType<typeof card>[]) => void = () => {}
    const first = new Promise<ReturnType<typeof card>[]>((resolve) => {
      resolveFirst = resolve
    })
    mocks.searchCards
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce([card('new', 'New result')])

    render(<CardSearchCommand open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search cards...')

    fireEvent.change(input, { target: { value: 'old' } })
    act(() => vi.advanceTimersByTime(300))
    fireEvent.change(input, { target: { value: 'new' } })
    act(() => vi.advanceTimersByTime(300))
    await act(async () => Promise.resolve())

    expect(screen.getByText('New result')).toBeTruthy()

    await act(async () => resolveFirst([card('old', 'Old result')]))
    expect(screen.queryByText('Old result')).toBeNull()
    expect(screen.getByText('New result')).toBeTruthy()
  })
})
