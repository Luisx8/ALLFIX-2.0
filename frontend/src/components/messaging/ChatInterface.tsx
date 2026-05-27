import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { subscribeToMessages } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/apiService';

interface ChatInterfaceProps {
  bookingId: string;
}

export function ChatInterface({ bookingId }: ChatInterfaceProps) {
  const { profile, role } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToMessages(bookingId, setMessages);
    return () => unsub();
  }, [bookingId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/api/messages', {
        booking_id: bookingId, sender_id: profile?.id,
        sender_role: role, content: input.trim(),
      });
      setInput('');
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
    }
  };

  const roleBadgeColor: Record<string, string> = {
    customer: 'bg-blue-100 text-blue-700', vendor: 'bg-emerald-100 text-emerald-700',
    admin: 'bg-purple-100 text-purple-700', personnel: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Chat — Booking #{bookingId.slice(0, 8)}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No messages yet</p>}
        {messages.map((msg) => {
          const isMe = msg.sender_id === profile?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'bg-brand-navy text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'} rounded-2xl px-4 py-2.5`}>
                {!isMe && (
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1 ${roleBadgeColor[msg.sender_role] || ''}`}>
                    {msg.sender_role}
                  </span>
                )}
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..." className="input-base flex-1" />
        <button onClick={handleSend} disabled={!input.trim() || sending}
          className="p-3 rounded-xl bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
