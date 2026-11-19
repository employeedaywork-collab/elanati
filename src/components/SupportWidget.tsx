import { useEffect, useState } from 'react';
import { MessageCircle, MessageSquare, Phone, Send, Search, X } from 'lucide-react';
import { formatWhatsAppLink, supabase } from '../lib/supabase';
import {
  createContactTicket,
  fetchTicketByCode,
  postSupportMessage,
} from '../services/dataService';
import { ContactMessage, SiteSettings, SupportMessage } from '../types';

interface SupportWidgetProps {
  settings: SiteSettings;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  initialTab?: 'new' | 'track' | 'direct';
  prefillSubject?: string;
  prefillAdId?: string | null;
  activeTicketCode?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: 'جديدة', cls: 'text-blue-700 bg-blue-50' },
  in_progress: { label: 'قيد المتابعة', cls: 'text-amber-700 bg-amber-50' },
  replied: { label: 'تم الرد', cls: 'text-emerald-700 bg-emerald-50' },
  closed: { label: 'مغلقة', cls: 'text-slate-600 bg-slate-100' },
};

export default function SupportWidget({
  settings,
  isOpen,
  onToggle,
  initialTab = 'new',
  prefillSubject = '',
  prefillAdId = null,
  activeTicketCode = null,
}: SupportWidgetProps) {
  const [tab, setTab] = useState<'new' | 'track' | 'direct'>(initialTab);
  const [newForm, setNewForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: prefillSubject || 'استفسار فوري',
    message: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [trackCode, setTrackCode] = useState<string>('');
  const [ticket, setTicket] = useState<ContactMessage | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (prefillSubject) {
      setNewForm((prev) => ({ ...prev, subject: prefillSubject }));
    }
  }, [prefillSubject]);

  useEffect(() => {
    const saved = activeTicketCode || localStorage.getItem('elanati_last_ticket_code') || '';
    if (saved) {
      setTrackCode(saved);
      if (activeTicketCode) {
        setTab('track');
        void loadTicket(saved);
      }
    }
  }, [activeTicketCode]);

  const loadTicket = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setLoadingTicket(true);
    setTrackError('');
    try {
      const res = await fetchTicketByCode(clean);
      if (!res.ticket) {
        setTicket(null);
        setMessages([]);
        setTrackError('لم يتم العثور على محادثة بهذا الرقم، تأكد من كود التذكرة.');
      } else {
        setTicket(res.ticket);
        setMessages(res.messages);
        try {
          localStorage.setItem('elanati_last_ticket_code', res.ticket.ticket_code);
        } catch {
          // ignore
        }
      }
    } catch {
      setTrackError('حدث خطأ أثناء تحميل المحادثة');
    } finally {
      setLoadingTicket(false);
    }
  };

  // Realtime subscription / light polling when viewing an open ticket
  useEffect(() => {
    if (!isOpen || tab !== 'track' || !ticket?.ticket_code) return;

    const client = supabase;
    if (client) {
      const channel = client
        .channel(`support-${ticket.ticket_code}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'elanati_support_messages',
            filter: `ticket_code=eq.${ticket.ticket_code}`,
          },
          () => {
            void loadTicket(ticket.ticket_code);
          }
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    }

    const timer = setInterval(() => {
      void loadTicket(ticket.ticket_code);
    }, 5000);
    return () => clearInterval(timer);
  }, [isOpen, tab, ticket?.ticket_code]);

  const handleCreateQuickTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const created = await createContactTicket({
        name: newForm.name,
        email: newForm.email || `${newForm.phone || 'client'}@elanati.local`,
        phone: newForm.phone,
        subject: newForm.subject,
        message: newForm.message,
        ad_id: prefillAdId,
      });
      try {
        localStorage.setItem('elanati_last_ticket_code', created.ticket_code);
        localStorage.setItem('elanati_last_client_name', newForm.name.trim());
      } catch {
        // ignore
      }
      setNewForm({ name: '', email: '', phone: '', subject: 'استفسار فوري', message: '' });
      setTrackCode(created.ticket_code);
      setTab('track');
      await loadTicket(created.ticket_code);
    } catch (err: any) {
      setCreateError(err?.message || 'تعذر بدء المحادثة');
    } finally {
      setCreating(false);
    }
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const clientName =
        localStorage.getItem('elanati_last_client_name') || ticket.name || 'عميل';
      await postSupportMessage({
        ticket_code: ticket.ticket_code,
        sender_role: 'client',
        sender_name: clientName,
        body: replyText,
      });
      setReplyText('');
      await loadTicket(ticket.ticket_code);
    } catch {
      setTrackError('تعذر إرسال الرسالة');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => onToggle(true)}
          aria-label="تواصل مع مدير الصفحة"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-2xl shadow-lg shadow-blue-900/25 font-bold text-sm transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span>تواصل مع الإدارة</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[390px] z-50 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[82vh] overflow-hidden"
          role="dialog"
          aria-label="مركز التواصل مع مدير المنصة"
        >
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base">تواصل مع مدير إعلاناتي</h3>
              <p className="text-xs text-slate-300">محادثة ومتابعة مباشرة للتذاكر</p>
            </div>
            <button
              type="button"
              onClick={() => onToggle(false)}
              aria-label="إغلاق نافذة التواصل"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1.5 bg-slate-100 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'new' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              رسالة جديدة
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('track');
                if (trackCode && !ticket) void loadTicket(trackCode);
              }}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'track' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              متابعة محادثة
            </button>
            <button
              type="button"
              onClick={() => setTab('direct')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'direct' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              واتساب واتصال
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-4">
            {tab === 'new' && (
              <form onSubmit={handleCreateQuickTicket} className="space-y-3">
                {createError && (
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">{createError}</div>
                )}
                <input
                  type="text"
                  required
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  placeholder="الاسم الكامل *"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    required
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    placeholder="رقم الهاتف *"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                  />
                  <input
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    placeholder="البريد (اختياري)"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={newForm.subject}
                  onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })}
                  placeholder="عنوان الموضوع"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
                />
                <textarea
                  required
                  rows={3}
                  value={newForm.message}
                  onChange={(e) => setNewForm({ ...newForm, message: e.target.value })}
                  placeholder="اكتب رسالتك لمدير المنصة..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  {creating ? 'جاري الفتح...' : 'بدء المحادثة والحصول على رقم المتابعة'}
                </button>
              </form>
            )}

            {tab === 'track' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadTicket(trackCode);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={trackCode}
                    onChange={(e) => setTrackCode(e.target.value)}
                    placeholder="أدخل رقم التذكرة مثل ELN-12345"
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                  />
                  <button
                    type="submit"
                    disabled={loadingTicket}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Search className="w-4 h-4" />
                    بحث
                  </button>
                </form>

                {trackError && <p className="text-xs text-red-600 font-medium">{trackError}</p>}

                {ticket ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 tabular-nums">
                          {ticket.ticket_code} · {ticket.subject}
                        </p>
                        <p className="text-[11px] text-slate-500">باسم: {ticket.name}</p>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                          STATUS_LABELS[ticket.status]?.cls || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[ticket.status]?.label || ticket.status}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-52 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl text-xs leading-relaxed ${
                            m.sender_role === 'admin'
                              ? 'bg-blue-700 text-white mr-6'
                              : 'bg-white border border-slate-200 text-slate-800 ml-6'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2 mb-1 opacity-80 text-[11px] font-bold">
                            <span>{m.sender_role === 'admin' ? 'إدارة المنصة' : m.sender_name}</span>
                            <span className="tabular-nums">
                              {new Date(m.created_at).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-line">{m.body}</p>
                        </div>
                      ))}
                    </div>

                    {ticket.status !== 'closed' && (
                      <form onSubmit={handleSendFollowUp} className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="اكتب ردك هنا..."
                          className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          aria-label="إرسال الرد"
                          className="px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">
                    أدخل كود التذكرة التي حصلت عليه عند إرسال رسالتك لمتابعة الردود الفورية من مدير الصفحة.
                  </p>
                )}
              </div>
            )}

            {tab === 'direct' && (
              <div className="space-y-3">
                <a
                  href={formatWhatsAppLink(
                    settings.whatsapp_number,
                    'مرحباً إدارة منصة إعلاناتي، أحتاج مساعدة'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5" />
                    <div>
                      <p className="font-bold text-sm">واتساب الإدارة المباشر</p>
                      <p className="text-xs text-emerald-100 tabular-nums">
                        {settings.contact_phone}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold">فتح ←</span>
                </a>

                <a
                  href={`tel:${settings.contact_phone}`}
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-700" />
                    <div>
                      <p className="font-bold text-sm">اتصال هاتفي</p>
                      <p className="text-xs text-slate-500 tabular-nums">{settings.contact_phone}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-700">اتصال ←</span>
                </a>

                <a
                  href={`mailto:${settings.contact_email}`}
                  className="block p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-900 transition-colors"
                >
                  <p className="font-bold text-sm">البريد الإلكتروني الرسمي</p>
                  <p className="text-xs text-slate-500 mt-0.5">{settings.contact_email}</p>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
