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
  ShieldAlert,
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
  fetchAdminPushConfig,
  fetchPendingPortalOtpsAdmin,
  fetchSiteSettings,
  getAdminSession,
  markPortalOtpSentAdmin,
  sendTestAdminWebPush,
  signOutAdmin,
  subscribeAdminWebPush,
  subscribeToPlatformDataChanged,
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
  '/admin/security': 'سجل الدخول والأمان',
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

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
    openReports: 0,
    blockedAttempts: 0,
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
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [hidePushBanner, setHidePushBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('elanati_hide_push_banner') === '1';
    } catch {
      return false;
    }
  });
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const seenOtpIdsRef = useRef<Set<string>>(new Set());
  const firstOtpLoadRef = useRef(true);
  const seenPendingAdsRef = useRef<number | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastShellRefreshAtRef = useRef(0);
  const shellRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js')
        .then(async (reg) => {
          swRegRef.current = reg;
          if ('pushManager' in reg) {
            const sub = await reg.pushManager.getSubscription();
            if (sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              setPushSubscribed(true);
              if (session && !session.isPreviewMode) {
                await subscribeAdminWebPush(sub.toJSON()).catch(() => {});
              }
            }
          }
        })
        .catch(() => {
          // ignore service worker registration errors in unsupported contexts
        });
    }
  }, [session]);

  const showMobileOrDesktopNotif = useCallback(
    async (title: string, body: string, tag?: string, targetUrl = '/admin/automation') => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const reg =
          swRegRef.current ||
          (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistration('/sw.js')
            : undefined);

        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            tag,
            renotify: true,
            vibrate: [220, 120, 220],
            data: { url: targetUrl },
          } as NotificationOptions);
          return;
        }
      } catch {
        // fall through to window Notification
      }

      try {
        const n = new Notification(title, { body, tag });
        n.onclick = () => {
          window.focus();
          navigate(targetUrl);
          n.close();
        };
      } catch {
        // Android Chrome forbids raw new Notification without SW; handled above
      }
    },
    [navigate]
  );

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
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([220, 120, 220]);
        } catch {
          // ignore vibration restrictions
        }
      }

      const latest = newOnes[0];
      void showMobileOrDesktopNotif(
        'طلب رمز تحقق (OTP) جديد — إعلاناتي',
        `العميل (+${latest.phone_digits}) يطلب استلام رمز التحقق (${latest.manual_otp_code || ''}) عبر واتساب الآن.`,
        `elanati-otp-${latest.id}`,
        '/admin/automation'
      );
    },
    [showMobileOrDesktopNotif, soundMuted]
  );

  const notifyPendingAds = useCallback(
    (pendingAdsCount: number) => {
      const prev = seenPendingAdsRef.current;
      seenPendingAdsRef.current = pendingAdsCount;

      if (prev === null || pendingAdsCount <= prev) {
        return;
      }

      if (!soundMuted) {
        playOtpAlertChime();
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([220, 120, 220]);
        } catch {
          // ignore vibration restrictions
        }
      }

      void showMobileOrDesktopNotif(
        '📢 إعلان جديد بانتظار الاعتماد — إعلاناتي',
        `يوجد الآن ${pendingAdsCount} إعلان بانتظار المراجعة والاعتماد في لوحة الإدارة.`,
        'elanati-pending-ads',
        '/admin/ads'
      );
    },
    [showMobileOrDesktopNotif, soundMuted]
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
      notifyPendingAds(counts.pendingAds);
      lastShellRefreshAtRef.current = Date.now();
      setRefreshTick((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  }, [notifyNewOtpRequests, notifyPendingAds, session]);

  const scheduleShellRefresh = useCallback(() => {
    if (shellRefreshTimerRef.current !== null) {
      window.clearTimeout(shellRefreshTimerRef.current);
    }
    shellRefreshTimerRef.current = window.setTimeout(() => {
      shellRefreshTimerRef.current = null;
      void refreshShell();
    }, 250);
  }, [refreshShell]);

  useEffect(() => {
    const siteName = settings.site_name || 'إعلاناتي';
    const defaultTitle = `${siteName} — لوحة تحكم المدير`;
    if (badges.pendingOtps > 0 && badges.pendingAds > 0) {
      document.title = `🔔 (${badges.pendingOtps}) OTP · (${badges.pendingAds}) إعلان — ${siteName}`;
    } else if (badges.pendingOtps > 0) {
      document.title = `🔔 (${badges.pendingOtps}) طلب كود OTP — ${siteName}`;
    } else if (badges.pendingAds > 0) {
      document.title = `📢 (${badges.pendingAds}) إعلان بانتظار الاعتماد — ${siteName}`;
    } else {
      document.title = defaultTitle;
    }
    return () => {
      document.title = defaultTitle;
    };
  }, [badges.pendingAds, badges.pendingOtps, settings.site_name]);

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
    setPushFeedback(null);
    if (typeof Notification === 'undefined') {
      setPushFeedback({
        type: 'err',
        text: 'على آيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية» أولاً لتفعيل الإشعارات.',
      });
      return;
    }

    setPushBusy(true);
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
      if (res !== 'granted') {
        setPushFeedback({
          type: 'err',
          text: 'تم رفض إذن الإشعارات من المتصفح. يمكنك السماح به من إعدادات الموقع.',
        });
        return;
      }

      playOtpAlertChime();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(150);
      }

      // Register real Web Push subscription when running on live Supabase + Service Worker
      if (
        session &&
        !session.isPreviewMode &&
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator
      ) {
        const reg =
          swRegRef.current || (await navigator.serviceWorker.register('/sw.js'));
        swRegRef.current = reg;
        const readyReg = await navigator.serviceWorker.ready;
        if ('pushManager' in readyReg) {
          const cfg = await fetchAdminPushConfig();
          if (cfg?.publicKey) {
            let sub = await readyReg.pushManager.getSubscription();
            if (!sub) {
              sub = await readyReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
              });
            }
            await subscribeAdminWebPush(sub.toJSON());
            setPushSubscribed(true);
            await sendTestAdminWebPush().catch(() => 0);
            setPushFeedback({
              type: 'ok',
              text: 'تم تفعيل إشعارات Web Push على هذا الجهاز! سيصلك إشعار فوري حتى عند إغلاق المتصفح.',
            });
            return;
          }
        }
      }

      await showMobileOrDesktopNotif(
        'تم تفعيل تنبيهات الموبايل بنجاح',
        'ستصلك إشعارات فورية فور طلب أي عميل لرمز التحقق (OTP).',
        'elanati-notif-enabled'
      );
      setPushSubscribed(true);
      setPushFeedback({
        type: 'ok',
        text:
          session && !session.isPreviewMode
            ? 'تم تفعيل إشعارات المتصفح لهذا الجهاز (لتفعيل إشعارات الخلفية Web Push بعد إغلاق المتصفح تأكد من رفع آخر تحديث إلى GitHub/Vercel).'
            : 'تم تفعيل الإشعارات المحلية على وضع المعاينة.',
      });
    } catch (err: any) {
      setPushFeedback({
        type: 'err',
        text: err?.message || 'تعذر إكمال ربط Web Push على هذا المتصفح',
      });
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestWebPush = async () => {
    setPushBusy(true);
    setPushFeedback(null);
    try {
      const sent = await sendTestAdminWebPush();
      setPushFeedback({
        type: 'ok',
        text: `تم إرسال إشعار تجريبي إلى ${sent} جهاز مسجل بنجاح.`,
      });
    } catch (err: any) {
      setPushFeedback({
        type: 'err',
        text: err?.message || 'تعذر إرسال الإشعار التجريبي',
      });
    } finally {
      setPushBusy(false);
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
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') return;
        void getAdminSession().then((s) => {
          if (!mounted) return;
          setSession((prev) => {
            if (!prev && !s) return prev;
            if (
              prev &&
              s &&
              prev.email === s.email &&
              prev.fullName === s.fullName &&
              prev.isPreviewMode === s.isPreviewMode
            ) {
              return prev;
            }
            return s;
          });
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

    const unsubscribeSync = subscribeToPlatformDataChanged(() => {
      scheduleShellRefresh();
    });

    const client = supabase;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    const ensureRealtimeChannel = () => {
      if (!client) return;
      const state = (channel as { state?: string } | null)?.state;
      if (channel && state !== 'closed' && state !== 'errored') {
        return;
      }
      if (channel) {
        void client.removeChannel(channel);
      }
      channel = client
        .channel(`elanati-admin-badges-live-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'elanati_ads' }, () => {
          scheduleShellRefresh();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_contact_messages' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_support_messages' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_package_requests' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_portal_otps' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_access_logs' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_ad_reports' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_site_settings' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_packages' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_testimonials' },
          () => {
            scheduleShellRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'elanati_categories' },
          () => {
            scheduleShellRefresh();
          }
        )
        .subscribe();
    };

    ensureRealtimeChannel();

    const handleWakeOrOnline = () => {
      if (document.visibilityState === 'hidden') return;
      ensureRealtimeChannel();
      if (Date.now() - lastShellRefreshAtRef.current > 2000) {
        scheduleShellRefresh();
      }
    };

    window.addEventListener('focus', handleWakeOrOnline);
    window.addEventListener('online', handleWakeOrOnline);
    document.addEventListener('visibilitychange', handleWakeOrOnline);

    // Polling fallback every 15s so OTP and pending-ad alerts trigger reliably even without WebSocket/Realtime
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      ensureRealtimeChannel();
      void Promise.all([fetchAdminBadgeCounts(), fetchPendingPortalOtpsAdmin()]).then(
        ([counts, otpItems]) => {
          const hadIncrease =
            seenPendingAdsRef.current !== null && counts.pendingAds > seenPendingAdsRef.current;
          setBadges({
            ...counts,
            pendingOtps: Math.max(counts.pendingOtps, otpItems.length),
          });
          setPendingOtpItems(otpItems);
          notifyNewOtpRequests(otpItems);
          notifyPendingAds(counts.pendingAds);
          if (hadIncrease) {
            setRefreshTick((t) => t + 1);
          }
        }
      );
    }, 15000);

    return () => {
      unsubscribeSync();
      window.removeEventListener('focus', handleWakeOrOnline);
      window.removeEventListener('online', handleWakeOrOnline);
      document.removeEventListener('visibilitychange', handleWakeOrOnline);
      window.clearInterval(pollTimer);
      if (shellRefreshTimerRef.current !== null) {
        window.clearTimeout(shellRefreshTimerRef.current);
      }
      if (client && channel) {
        void client.removeChannel(channel);
      }
    };
  }, [notifyNewOtpRequests, notifyPendingAds, refreshShell, scheduleShellRefresh, session]);

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
    {
      to: '/admin/security',
      label: 'سجل الدخول والأمان',
      icon: ShieldAlert,
      badge: badges.openReports + badges.blockedAttempts,
    },
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
              {(badges.pendingOtps > 0 || badges.pendingAds > 0) && (
                <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
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
            {badges.pendingAds > 0 && (
              <Link
                to="/admin/ads"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition-colors animate-pulse"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">بانتظار الاعتماد:</span>
                <span className="tabular-nums">{badges.pendingAds}</span>
              </Link>
            )}
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
            {!pushSubscribed ? (
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void handleEnableBrowserNotifs()}
                title="تفعيل إشعارات الموبايل (Web Push) حتى عند إغلاق المتصفح"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-800 text-xs font-bold transition-colors"
              >
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {pushBusy ? 'جاري التفعيل...' : 'تفعيل إشعارات الموبايل'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void handleTestWebPush()}
                title="إرسال إشعار تجريبي لموبايلك الآن"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-blue-800 text-xs font-bold transition-colors"
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">اختبار الإشعار</span>
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
          {pushFeedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 ${
                pushFeedback.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              <span>{pushFeedback.text}</span>
              <button
                type="button"
                onClick={() => setPushFeedback(null)}
                className="underline shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          {!pushSubscribed && !hidePushBanner && notifPerm !== 'denied' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-blue-950">
                <Bell className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">
                    فعّل إشعارات Web Push على موبايلك لاستلام تنبيهات طلبات OTP حتى عند إغلاق المتصفح
                  </p>
                  <p className="text-blue-800 mt-0.5">
                    على آيفون: أضف الصفحة للشاشة الرئيسية أولاً عبر زر المشاركة ثم افتحها واضغط التفعيل.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={() => void handleEnableBrowserNotifs()}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {pushBusy ? 'جاري التفعيل...' : 'تفعيل على هذا الجهاز'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHidePushBanner(true);
                    try {
                      localStorage.setItem('elanati_hide_push_banner', '1');
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-2.5 py-2 rounded-xl text-blue-700 hover:bg-blue-100 text-xs font-bold"
                >
                  لاحقاً
                </button>
              </div>
            </div>
          )}
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

          {badges.pendingAds > 0 && location.pathname !== '/admin/ads' && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-amber-950">
                    تنبيه: يوجد {badges.pendingAds} إعلان جديد بانتظار المراجعة والاعتماد!
                  </p>
                  <p className="text-xs text-amber-900">
                    قام أحد المعلنين بإضافة إعلان جديد ولن يظهر للجمهور إلا بعد اعتماده من قسم إدارة الإعلانات.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  to="/admin/ads"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition-colors"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  مراجعة واعتماد الإعلانات الآن
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
