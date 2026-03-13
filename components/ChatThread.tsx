'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChatInput from './ChatInput'
import Link from 'next/link'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface Props {
  matchId: string
  myHandle: string
  myDae: string
  theirHandle: string
  theirDae: string
  myUserId: string
  initialMessages: Message[]
}

export default function ChatThread({
  matchId,
  myHandle,
  myDae,
  theirHandle,
  theirDae,
  myUserId,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Subscribe to new messages via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content: string) {
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: myUserId,
      content,
    })
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col bg-stone-50" style={{ height: '100dvh' }}>
      {/* Sticky header: both DAEs */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/threads" className="text-stone-400 hover:text-stone-700 text-sm">←</Link>
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">Your match</span>
        </div>
        <div className="space-y-2">
          <div className="bg-stone-50 rounded-xl px-3 py-2">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">
              You ({myHandle})
            </p>
            <p className="text-stone-700 text-sm leading-snug line-clamp-2">
              "Does anyone else {myDae}"
            </p>
          </div>
          <div className="bg-amber-50 rounded-xl px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-0.5">
              {theirHandle}
            </p>
            <p className="text-stone-700 text-sm leading-snug line-clamp-2">
              "Does anyone else {theirDae}"
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-stone-400 text-sm py-8">
            <p className="mb-1">You matched! 👋</p>
            <p>Say hi and start the conversation.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === myUserId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <span className="text-[10px] text-stone-400 px-1">
                  {isMe ? myHandle : theirHandle}
                </span>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-stone-900 text-white rounded-br-sm'
                      : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-stone-300 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} />
    </div>
  )
}
