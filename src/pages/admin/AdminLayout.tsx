import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Bot,
  ExternalLink,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import AdminAuth from '../../components/admin/AdminAuth';
import { DEFAULT_SITE_SETTINGS } from '../../data/seedData';
import { formatWhatsAppLink, supabase } from '../../lib/supabase';
import {
  archiveExpiredAdsAdmin,
  fetchAdminBadgeCounts,
  fetchPendingPortalOtpsAdmin,
  fetchSiteSettings,
  getAdminSession,
  markPortalOtpSentAdmin,
  signOutAdmin,
} from '../../services/dataService';
import { AdminSession, PendingPortalOtp, SiteSettings } from '../../types';

export interface AdminOutletContext {
  session: AdminSession;
  settings: SiteSettings;
  refreshTick: number;
  onTriggerRefresh: () => Promise<void>;
}

export function useAdminContext(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'نظرة عامة',
  '/admin/overview': 'نظرة عامة',
  '/admin/ads': 'إدارة الإعلانات',
  '/admin/inbox': 'مركز التواصل والرسائل',
  '/admin/packages': 'متابعة الاشتراكات والدفعات',
  '/admin/automation': 'الأتمتة والواتساب',
  '/admin/settings': 'المحتوى والإعدادات',
};

function AdminTabLoader() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
      <div className="w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs font-bold text-slate-500">جاري تحميل القسم...</p>
    </div>
  );
}

function playOtpAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [784, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.28);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 900);
  } catch {
    // ignore autoplay/audio context errors
  }
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [badges, setBadges] = useState({
    pendingAds: 0,
    openTickets: 0,
    pendingPackages: 0,
    pendingOtps: 0,
  });
  const [pendingOtpItems, setPendingOtpItems] = useState<PendingPortalOtp[]>([]);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('elanati_admin_mute_otp') === '1';
    } catch {
      return false;
    }
  });
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const seenOtpIdsRef = useRef<Set<string>>(new Set());
  const firstOtpLoadRef = useRef(true);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const notifyNewOtpRequests = useCallback(
    (otps: PendingPortalOtp[]) => {
      const currentIds = new Set(otps.map((o) => o.id));
      const newOnes = otps.filter((o) => !seenOtpIdsRef.current.has(o.id));
      seenOtpIdsRef.current = currentIds;

      if (firstOtpLoadRef.current) {
        firstOtpLoadRef.current = false;
        return;
      }
      if (newOnes.length === 0) return;

      if (!soundMuted) {
        playOtpAlertChime();
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const latest = newOnes[0];
          const n = new Notification('طلب رمز تحقق (OTP) جديد — إعلاناتي', {
            body: `العميل (+${latest.phone_digits}) يطلب استلام رمز التحقق (${latest.manual_otp_code || ''}) عبر واتساب الآن.`,
            tag: `elanati-otp-${latest.id}`,
          });
          n.onclick = () => {
            window.focus();
            navigate('/admin/automation');
            n.close();
          };
        } catch {
          // ignore browser notification restrictions
        }
      }
    },
    [navigate, soundMuted]
  );

  const refreshShell = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    try {
      await archiveExpiredAdsAdmin().catch(() => 0);
      const [loadedSettings, counts, otpItems] = await Promise.all([
        fetchSiteSettings(),
        fetchAdminBadgeCounts(),
        fetchPendingPortalOtpsAdmin(),
      ]);
      setSettings(loadedSettings);
      setBadges({
        ...counts,
        pendingOtps: Math.max(counts.pendingOtps, otpItems.length),
      });
      setPendingOtpItems(otpItems);
      notifyNewOtpRequests(otpItems);
      setRefreshTick((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  }, [notifyNewOtpRequests, session]);

  useEffect(() => {
    const defaultTitle = `${settings.site_name || 'إعلاناتي'} — لوحة تحكم المدير`;
    if (badges.pendingOtps > 0) {
      document.title = `🔔 (${badges.pendingOtps}) طلب كود OTP — ${settings.site_name || 'إعلاناتي'}`;
    } else {
      document.title = defaultTitle;
    }
    return () => {
      document.title = defaultTitle;
    };
  }, [badges.pendingOtps, settings.site_name]);

  const toggleSoundMute = () => {
    setSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('elanati_admin_mute_otp', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      if (!next) {
        playOtpAlertChime();
      }
      return next;
    });
  };

  const handleEnableBrowserNotifs = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
      if (res === 'granted') {
        playOtpAlertChime();
        new Notification('تم تفعيل تنبيهات إعلاناتي بنجاح', {
          body: 'ستصلك إشعارات فورية فور طلب أي عميل لرمز التحقق (OTP).',
        });
      }
    } catch {
      // ignore permission prompt error
    }
  };

  const handleQuickMarkOtpSent = async (otpId: string) => {
    try {
      await markPortalOtpSentAdmin(otpId);
      setPendingOtpItems((prev) => prev.filter((item) => item.id !== otpId));
      setBadges((prev) => ({ ...prev, pendingOtps: Math.max(0, prev.pendingOtps - 1) }));
      setRefreshTick((t) => t + 1);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const s = await getAdminSession();
        if (mounted) setSession(s);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    };
    void initAuth();

    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void getAdminSession().then((s) => {
          if (mounted) setSession(s);
        });
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshShell();

    // Polling fallback every 15s so OTP alerts trigger reliably even without WebSocket/Realtime
    const pollTimer = setInterval(() => {
      void Promise.all([fetchAdminBadgeCounts(), fetchPendingPortalOtpsAdmin()]).then(
        ([counts, otpItems]) => {
          setBadges({
            ...counts,
            pendingOtps: Math.max(counts.pendingOtps, otpItems.length),
          });
          setPendingOtpItems(otpItems);
          notifyNewOtpRequests(otpItems);
        }
      );
    }, 15000);

    const client = supabase;
    if (client) {
      const channel = client
        .channel('elanati-admin-badges-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'elanati_ads' }, () => {
          void refreshShell();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_contact_messages' },
          () => {
            void refreshShell();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_package_requests' },
          () => {
            void refreshShell();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_portal_otps' },
          () => {
            void refreshShell();
          }
        )
        .subscribe();

      return () => {
        clearInterval(pollTimer);
        void client.removeChannel(channel);
      };
    }

    return () => {
      clearInterval(pollTimer);
    };
  }, [notifyNewOtpRequests, refreshShell, session]);

  const handleSignOut = async () => {
    await signOutAdmin();
    setSession(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600">جاري التحقق من جلسة المدير...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AdminAuth onSuccess={(newSession) => setSession(newSession)} />;
  }

  const navItems: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { to: '/admin/overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { to: '/admin/ads', label: 'إدارة الإعلانات', icon: Megaphone, badge: badges.pendingAds },
    { to: '/admin/inbox', label: 'تواصل العملاء', icon: Inbox, badge: badges.openTickets },
    {
      to: '/admin/packages',
      label: 'متابعة الاشتراكات والدفعات',
      icon: Layers,
      badge: badges.pendingPackages,
    },
    { to: '/admin/automation', label: 'الأتمتة والواتساب', icon: Bot, badge: badges.pendingOtps },
    { to: '/admin/settings', label: 'المحتوى والإعدادات', icon: Settings },
  ];

  const pageTitle = ROUTE_TITLES[location.pathname] || 'لوحة تحكم المدير';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-slate-900 text-white sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm truncate">{settings.site_name}</p>
            <p className="text-[11px] text-slate-400">لوحة تحكم المدير</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums ${
                          isActive ? 'bg-white/20 text-white' : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <p className="font-bold text-white truncate">{session.fullName}</p>
            <p className="text-slate-400 truncate mt-0.5" dir="ltr">
              {session.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              عرض الموقع
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-white flex flex-col h-full z-10">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="font-extrabold text-sm">لوحة تحكم المدير</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="إغلاق القائمة"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-bold ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-400 text-slate-950 tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 flex items-center gap-2">
              <Link
                to="/"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-white"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                عرض الموقع
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3 py-2.5 rounded-xl bg-red-600/20 text-red-300 text-xs font-bold"
              >
                خروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="فتح القائمة"
              className="relative lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
              {badges.pendingOtps > 0 && (
                <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-white animate-pulse" />
              )}
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{pageTitle}</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                إدارة منصة {settings.site_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {badges.pendingOtps > 0 && (
              <Link
                to="/admin/automation"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors animate-pulse"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طلبات OTP بانتظارك:</span>
                <span className="tabular-nums">{badges.pendingOtps}</span>
              </Link>
            )}
            {notifPerm === 'default' && (
              <button
                type="button"
                onClick={() => void handleEnableBrowserNotifs()}
                title="تفعيل إشعارات المتصفح لطلبات الأكواد"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                تفعيل الإشعارات
              </button>
            )}
            <button
              type="button"
              onClick={toggleSoundMute}
              title={soundMuted ? 'تشغيل صوت تنبيه طلبات OTP' : 'كتم صوت تنبيه طلبات OTP'}
              aria-label={soundMuted ? 'تشغيل صوت التنبيه' : 'كتم صوت التنبيه'}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
            </button>
            <button
              type="button"
              onClick={() => void refreshShell()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              الواجهة العامة
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
          {pendingOtpItems.length > 0 && location.pathname !== '/admin/automation' && (
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-emerald-950">
                    تنبيه: يوجد {pendingOtpItems.length} عميل يطلب استلام رمز التحقق (OTP) الآن!
                  </p>
                  <p className="text-xs text-emerald-900">
                    أحدث طلب للرقم{' '}
                    <span dir="ltr" className="font-mono font-bold">
                      +{pendingOtpItems[0].phone_digits}
                    </span>{' '}
                    — الكود:{' '}
                    <span className="font-mono font-extrabold bg-white px-2 py-0.5 rounded border border-emerald-300 tracking-widest">
                      {pendingOtpItems[0].manual_otp_code}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={formatWhatsAppLink(
                    pendingOtpItems[0].phone_digits,
                    `مرحباً بك في منصة إعلاناتي 👋\nرمز التحقق (OTP) لعرض اشتراكاتك ومدفوعاتك هو: *${pendingOtpItems[0].manual_otp_code || ''}*\nصالح لمدة 10 دقائق، ولا تشاركه مع أي شخص.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void handleQuickMarkOtpSent(pendingOtpItems[0].id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  إرسال الكود لواتساب العميل الآن
                </a>
                <Link
                  to="/admin/automation"
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors"
                >
                  فتح قائمة الأكواد
                </Link>
              </div>
            </div>
          )}

          <Suspense fallback={<AdminTabLoader />}>
            <Outlet
              context={{
                session,
                settings,
                refreshTick,
                onTriggerRefresh: refreshShell,
              }}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
