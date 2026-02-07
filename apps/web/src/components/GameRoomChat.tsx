import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@convex/_generated/api'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { MessageCircle, X } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'

const PAGE_SIZE = 50
const BOTTOM_THRESHOLD_PX = 48

interface GameRoomChatProps {
  roomId: string
}

export function GameRoomChat({ roomId }: GameRoomChatProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)
  const pendingScrollAdjustRef = useRef<{
    scrollHeight: number
    scrollTop: number
  } | null>(null)

  const sendMessage = useMutation(api.chat.sendMessage)
  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.listMessages,
    { roomId },
    { initialNumItems: PAGE_SIZE },
  )

  const messages = useMemo(() => [...results].reverse(), [results])

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD_PX

    if (container.scrollTop <= 80 && status === 'CanLoadMore') {
      pendingScrollAdjustRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      }
      loadMore(PAGE_SIZE)
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    if (pendingScrollAdjustRef.current) {
      const { scrollHeight, scrollTop } = pendingScrollAdjustRef.current
      const newScrollHeight = container.scrollHeight
      container.scrollTop = newScrollHeight - scrollHeight + scrollTop
      pendingScrollAdjustRef.current = null
    }
  }, [messages.length])

  useEffect(() => {
    const latestMessageId = results[0]?._id ?? null
    if (!latestMessageId || latestMessageId === lastMessageIdRef.current) return

    if (!isOpen || !shouldStickToBottomRef.current) {
      setUnreadCount((prev) => prev + 1)
    }

    lastMessageIdRef.current = latestMessageId
  }, [results, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const container = scrollContainerRef.current
    if (!container) return
    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }
  }, [messages.length, isOpen])

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        setUnreadCount(0)
        requestAnimationFrame(() => {
          const container = scrollContainerRef.current
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        })
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!message.trim() || isSending) return
    setIsSending(true)
    try {
      await sendMessage({ roomId, message })
      setMessage('')
      shouldStickToBottomRef.current = true
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
    [],
  )

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
      <Button
        type="button"
        variant={isOpen ? 'secondary' : 'default'}
        className="pointer-events-auto relative flex items-center gap-2"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls="room-chat-panel"
      >
        <MessageCircle className="h-4 w-4" />
        <span>Chat</span>
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <Card
          id="room-chat-panel"
          className="pointer-events-auto flex w-80 flex-col overflow-hidden border border-surface-2 bg-surface-1/95 shadow-lg"
          aria-label="Room chat panel"
        >
          <div className="border-surface-2 bg-surface-0/60 flex items-center justify-between border-b px-3 py-2">
            <div className="text-text-secondary text-sm font-medium">
              Room Chat
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-muted hover:text-text-primary h-7 w-7 p-0"
              onClick={handleToggle}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex max-h-[40vh] flex-1 flex-col gap-3 overflow-y-auto px-3 py-2 text-sm"
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
          >
            {status === 'LoadingFirstPage' && (
              <div className="text-text-muted text-xs">Loading chat…</div>
            )}
            {status === 'CanLoadMore' && (
              <div className="text-text-muted text-center text-xs">
                Scroll up to load older messages
              </div>
            )}
            {messages.length === 0 && status !== 'LoadingFirstPage' && (
              <div className="text-text-muted text-xs">
                No messages yet. Start the conversation!
              </div>
            )}
            {messages.map((item) => {
              const isOwnMessage = item.userId === user?.id
              return (
                <div
                  key={item._id}
                  className={`flex flex-col gap-1 ${
                    isOwnMessage ? 'items-end text-right' : 'items-start'
                  }`}
                >
                  <div className="text-text-muted text-xs">
                    {item.username} · {timeFormatter.format(new Date(item.createdAt))}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      isOwnMessage
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-surface-2 text-text-primary'
                    }`}
                  >
                    {item.message}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-surface-2 flex items-center gap-2 border-t px-3 py-2">
            <Input
              placeholder="Type a message…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              className="bg-surface-0"
              aria-label="Chat message"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={!message.trim() || isSending}
            >
              Send
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
