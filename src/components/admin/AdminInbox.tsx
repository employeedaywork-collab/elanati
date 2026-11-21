import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, Search, Send } from 'lucide-react';
import { formatWhatsAppLink, sanitizePhoneHref, supabase } from '../../lib/supabase';
import {
  fetchTicketMessagesAdmin,
  postSupportMessage,
  updateTicketStatusAdmin,
} from '../../services/dataService';
import { ContactMessage, SupportMessage, TicketStatus } from '../../types';

interface AdminInboxProps {
  tickets: ContactMessage[];
  initialSelectedCode?: string | null;
  adminName: string;
  onRefresh: () => Promise<void>;
}

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  new: { label: 'جديدة', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  in_progress: { label: 'قيد المتابعة', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  replied: { label: 'تم الرد', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  closed: { label: 'مغلقة', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

export default function AdminInbox({
  tickets,
  initialSelectedCode,
  adminName,
  onRefresh,
}: AdminInboxProps) {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(
    initialSelectedCode || tickets[0]?.ticket_code || null
  );
  const [thread, setThread] = useState<SupportMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (initialSelectedCode) {
      setSelectedCode(initialSelectedCode);
    } else if (!selectedCode && tickets.length > 0) {
      setSelectedCode(tickets[0].ticket_code);
    }
  }, [initialSelectedCode, tickets, selectedCode]);

  const selectedTicket = tickets.find((t) => t.ticket_code === selectedCode) || null;

  const loadThread = async (code: string) => {
    setLoadingThread(true);
    try {
      const msgs = await fetchTicketMessagesAdmin(code);
      setThread(msgs);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (!selectedCode) {
      setThread([]);
      return;
    }
    void loadThread(selectedCode);

    const client = supabase;
    if (client) {
      const channel = client
        .channel(`admin-inbox-${selectedCode}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'elanati_support_messages',
            filter: `ticket_code=eq.${selectedCode}`,
          },
          () => {
            void loadThread(selectedCode);
            void onRefresh();
          }
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    }
  }, [selectedCode]);

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.ticket_code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    setSending(true);
    try {
      await postSupportMessage({
        ticket_code: selectedTicket.ticket_code,
        sender_role: 'admin',
        sender_name: adminName,
        body: replyBody,
      });
      setReplyBody('');
      await Promise.all([loadThread(selectedTicket.ticket_code), onRefresh()]);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    await updateTicketStatusAdmin(selectedTicket.id, status);
    await onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم التذكرة أو اسم العميل..."
              className="w-full pr-10 pl-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                ['all', 'الكل'],
                ['new', 'جديدة'],
                ['in_progress', 'متابعة'],
                ['replied', 'تم الرد'],
                ['closed', 'مغلقة'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                  statusFilter === k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد رسائل أو تذاكر حالياً.
            </div>
          ) : (
            filteredTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedCode(t.ticket_code)}
                className={`w-full text-right p-4 transition-colors ${
                  selectedCode === t.ticket_code ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-extrabold text-sm text-slate-900 truncate">{t.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.priority && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        أولوية
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        STATUS_META[t.status]?.cls || 'bg-slate-100'
                      }`}
                    >
                      {STATUS_META[t.status]?.label || t.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs font-bold text-blue-700 tabular-nums mb-1">
                  {t.ticket_code} · {t.subject}
                </p>
                <p className="text-xs text-slate-500 line-clamp-2">{t.message}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[520px]">
        {selectedTicket ? (
          <>
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-blue-700 tabular-nums mb-1">
                  <span>{selectedTicket.ticket_code}</span>
                  <span>·</span>
                  <span>{selectedTicket.subject}</span>
                  {selectedTicket.priority && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      عميل مميز · أولوية
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">{selectedTicket.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {selectedTicket.email} {selectedTicket.phone ? `· ${selectedTicket.phone}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedTicket.phone && (
                  <>
                    <a
                      href={formatWhatsAppLink(
                        selectedTicket.phone,
                        `مرحباً ${selectedTicket.name}، بخصوص رسالتك رقم ${selectedTicket.ticket_code} على منصة إعلاناتي:`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      واتساب
                    </a>
                    <a
                      href={`tel:${sanitizePhoneHref(selectedTicket.phone)}`}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      اتصال
                    </a>
                  </>
                )}
                {selectedTicket.email && !selectedTicket.email.endsWith('@elanati.local') && (
                  <a
                    href={`mailto:${selectedTicket.email}?subject=${encodeURIComponent(
                      `رد على تذكرتك ${selectedTicket.ticket_code} - منصة إعلاناتي`
                    )}`}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    بريد
                  </a>
                )}

                <select
                  aria-label="حالة التذكرة"
                  value={selectedTicket.status}
                  onChange={(e) => void handleStatusChange(e.target.value as TicketStatus)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="new">جديدة</option>
                  <option value="in_progress">قيد المتابعة</option>
                  <option value="replied">تم الرد</option>
                  <option value="closed">مغلقة</option>
                </select>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[380px] bg-slate-50/70">
              {loadingThread ? (
                <p className="text-xs text-slate-500 text-center py-10">جاري تحميل المحادثة...</p>
              ) : thread.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700">
                  {selectedTicket.message}
                </div>
              ) : (
                thread.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.sender_role === 'admin'
                        ? 'bg-blue-700 text-white mr-10'
                        : 'bg-white border border-slate-200 text-slate-800 ml-10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 text-xs opacity-80 font-bold">
                      <span>{msg.sender_role === 'admin' ? `${msg.sender_name} (الإدارة)` : msg.sender_name}</span>
                      <span className="tabular-nums">
                        {new Date(msg.created_at).toLocaleString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-line">{msg.body}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-100 bg-white flex gap-2">
              <input
                type="text"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="اكتب رد المدير ليظهر فوراً للعميل في نافذة المتابعة..."
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={sending || !replyBody.trim()}
                className="px-5 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm inline-flex items-center gap-2 shrink-0"
              >
                <Send className="w-4 h-4" />
                إرسال الرد
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-10 text-sm text-slate-500">
            اختر رسالة أو تذكرة من القائمة لعرض التفاصيل والرد على العميل.
          </div>
        )}
      </div>
    </div>
  );
}
