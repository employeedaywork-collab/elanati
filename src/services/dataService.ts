import {
  DEFAULT_AUTOMATION_CONFIG,
  DEFAULT_CATEGORIES,
  DEFAULT_SITE_SETTINGS,
  INITIAL_ADS,
  INITIAL_PACKAGES,
  INITIAL_TESTIMONIALS,
} from '../data/seedData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  Ad,
  AdAllowance,
  AdCategory,
  AdStatus,
  AdminSession,
  AutomationConfig,
  AutomationRunResult,
  AutomationTargetPreview,
  CategoryItem,
  ClientPortalData,
  ContactMessage,
  PackagePlan,
  PackageRequest,
  PackageRequestStatus,
  PaymentMethod,
  SiteSettings,
  SupportMessage,
  Testimonial,
  TicketStatus,
  WhatsAppLog,
} from '../types';

const STORAGE_KEYS = {
  ads: 'elanati_local_ads_v1',
  categories: 'elanati_local_categories_v1',
  messages: 'elanati_local_messages_v1',
  support: 'elanati_local_support_v1',
  packageRequests: 'elanati_local_pkg_requests_v1',
  packages: 'elanati_local_packages_v1',
  testimonials: 'elanati_local_testimonials_v1',
  settings: 'elanati_local_settings_v1',
  automationConfig: 'elanati_local_automation_cfg_v1',
  whatsappLogs: 'elanati_local_wa_logs_v1',
  previewAdmin: 'elanati_preview_admin_v1',
};

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function generateTicketCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ELN-${num}`;
}

export function generateSubscriptionCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `SUB-${num}`;
}

export function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeClientName(name?: string | null): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePhoneToWhatsApp(phone: string): string {
  const digits = normalizeDigits(phone);
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  return digits;
}

export function isAdExpired(ad: Pick<Ad, 'expires_at'>): boolean {
  if (!ad.expires_at) return false;
  return new Date(ad.expires_at).getTime() <= Date.now();
}

export function getRemainingDays(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeAdRow(row: any): Ad {
  return {
    ...row,
    extra_images: Array.isArray(row.extra_images) ? row.extra_images : [],
    priority_rank: typeof row.priority_rank === 'number' ? row.priority_rank : 0,
    client_edits_count: typeof row.client_edits_count === 'number' ? row.client_edits_count : 0,
    last_client_edited_at: row.last_client_edited_at || null,
  } as Ad;
}

// ============================================================================
// Site Settings
// ============================================================================
export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      return {
        ...DEFAULT_SITE_SETTINGS,
        ...(data as Partial<SiteSettings>),
      };
    }
  }
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...readLocal<Partial<SiteSettings>>(STORAGE_KEYS.settings, DEFAULT_SITE_SETTINGS),
  };
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await fetchSiteSettings();
  const updated: SiteSettings = {
    ...current,
    ...patch,
    id: 1,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_site_settings')
      .upsert(updated)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...DEFAULT_SITE_SETTINGS, ...(data as Partial<SiteSettings>) };
  }

  writeLocal(STORAGE_KEYS.settings, updated);
  return updated;
}

// ============================================================================
// Categories (Dynamic Custom Categories)
// ============================================================================
function mergeUniqueCategories(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const clean = (raw || '').trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        result.push(clean);
      }
    }
  }
  return result;
}

export async function fetchCategories(): Promise<string[]> {
  if (supabase) {
    const [catRes, adsRes] = await Promise.all([
      supabase
        .from('elanati_categories')
        .select('name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('elanati_ads').select('category').eq('status', 'approved'),
    ]);

    const dbCategories =
      !catRes.error && Array.isArray(catRes.data)
        ? catRes.data.map((row: any) => String(row.name || ''))
        : [];
    const adCategories =
      !adsRes.error && Array.isArray(adsRes.data)
        ? adsRes.data.map((row: any) => String(row.category || ''))
        : [];

    if (!catRes.error || !adsRes.error) {
      return mergeUniqueCategories(DEFAULT_CATEGORIES, dbCategories, adCategories);
    }
  }

  const localCats = readLocal<CategoryItem[]>(
    STORAGE_KEYS.categories,
    DEFAULT_CATEGORIES.map((name, idx) => ({
      id: `cat-default-${idx}`,
      name,
      sort_order: idx + 1,
      is_active: true,
    }))
  )
    .filter((c) => c.is_active)
    .map((c) => c.name);
  const localAds = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS).map((a) => a.category);

  return mergeUniqueCategories(DEFAULT_CATEGORIES, localCats, localAds);
}

export async function fetchCategoryItemsAdmin(): Promise<CategoryItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data as CategoryItem[];
    }
  }

  const existing = readLocal<CategoryItem[]>(
    STORAGE_KEYS.categories,
    DEFAULT_CATEGORIES.map((name, idx) => ({
      id: `cat-default-${idx}`,
      name,
      sort_order: idx + 1,
      is_active: true,
    }))
  );

  // Also ensure any ad categories are represented
  const existingNames = new Set(existing.map((c) => c.name.trim()));
  const ads = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  const extras: CategoryItem[] = [];
  for (const ad of ads) {
    const clean = (ad.category || '').trim();
    if (clean && !existingNames.has(clean)) {
      existingNames.add(clean);
      extras.push({
        id: generateId('cat'),
        name: clean,
        sort_order: 10 + existing.length + extras.length,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }
  }

  if (extras.length > 0) {
    const merged = [...existing, ...extras];
    writeLocal(STORAGE_KEYS.categories, merged);
    return merged;
  }

  return existing;
}

export async function addCategory(name: string): Promise<string> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 60) {
    throw new Error('اسم التصنيف يجب أن يكون بين حرفين و60 حرفاً');
  }

  if (supabase) {
    const { data: existing } = await supabase
      .from('elanati_categories')
      .select('id, name, is_active')
      .eq('name', clean)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        await supabase
          .from('elanati_categories')
          .update({ is_active: true })
          .eq('id', existing.id);
      }
      return existing.name;
    }

    const { error } = await supabase.from('elanati_categories').insert({
      name: clean,
      sort_order: 20,
      is_active: true,
    });

    // Ignore duplicate race condition (23505)
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      throw new Error(error.message);
    }
    return clean;
  }

  const current = await fetchCategoryItemsAdmin();
  const exists = current.find((c) => c.name.trim() === clean);
  if (exists) {
    if (!exists.is_active) {
      writeLocal(
        STORAGE_KEYS.categories,
        current.map((c) => (c.id === exists.id ? { ...c, is_active: true } : c))
      );
    }
    return clean;
  }

  const nextItem: CategoryItem = {
    id: generateId('cat'),
    name: clean,
    sort_order: current.length + 1,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  writeLocal(STORAGE_KEYS.categories, [...current, nextItem]);
  return clean;
}

export async function deleteCategoryAdmin(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('elanati_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }

  const current = await fetchCategoryItemsAdmin();
  writeLocal(
    STORAGE_KEYS.categories,
    current.filter((c) => c.id !== id)
  );
}

// ============================================================================
// Client Allowance & Subscription Portal
// ============================================================================
export async function checkAdAllowance(
  contact: string,
  subscriptionCode?: string,
  clientName?: string
): Promise<AdAllowance> {
  const settings = await fetchSiteSettings();
  const freeDays = Math.max(1, settings.free_ad_days || 7);
  const proDays = Math.max(1, settings.pro_ad_days || 30);

  if (supabase) {
    const { data, error } = await supabase.rpc('check_elanati_ad_allowance', {
      p_contact: contact,
      p_subscription_code: subscriptionCode || null,
      p_client_name: clientName?.trim() || null,
    });
    if (!error && data) {
      return data as AdAllowance;
    }
  }

  const digits = normalizeDigits(contact);
  const normalizedName = normalizeClientName(clientName);
  const cleanCode = (subscriptionCode || '').trim().toUpperCase();
  const requests = readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
  const activeSub = requests.find(
    (r) =>
      r.status === 'activated' &&
      (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()) &&
      ((cleanCode && (r.subscription_code || '').toUpperCase() === cleanCode) ||
        (digits && normalizeDigits(r.client_phone) === digits))
  );

  const ads = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  const activeClientAds = ads.filter(
    (a) =>
      (a.status === 'approved' || a.status === 'pending') &&
      !isAdExpired(a) &&
      ((activeSub?.subscription_code &&
        (a.subscription_code || '').toUpperCase() === activeSub.subscription_code.toUpperCase()) ||
        (digits && normalizeDigits(a.contact) === digits))
  );

  if (activeSub) {
    const maxAds = activeSub.max_ads || (activeSub.package_name === 'المؤسسي' ? 999999 : 10);
    const isEnterprise = activeSub.package_name === 'المؤسسي';
    return {
      allowed: activeClientAds.length < maxAds,
      package_name: activeSub.package_name,
      subscription_code: activeSub.subscription_code,
      subscription_expires_at: activeSub.expires_at || null,
      max_ads: maxAds,
      used_ads: activeClientAds.length,
      duration_days: isEnterprise ? null : proDays,
      is_permanent: isEnterprise,
      featured: true,
      priority_rank: isEnterprise ? 2 : 1,
      allow_extra_images: true,
      allow_banner: isEnterprise,
      free_trial_used: false,
      free_block_reason: null,
    };
  }

  // Free plan is strictly once only per mobile number OR advertiser name (across active & expired/archived non-rejected ads)
  const usedByPhone = Boolean(
    digits &&
      ads.some(
        (a) =>
          (a.package_name || 'مجاني') === 'مجاني' &&
          a.status !== 'rejected' &&
          normalizeDigits(a.contact) === digits
      )
  );
  const usedByName = Boolean(
    normalizedName &&
      ads.some(
        (a) =>
          (a.package_name || 'مجاني') === 'مجاني' &&
          a.status !== 'rejected' &&
          normalizeClientName(a.client_name) === normalizedName
      )
  );
  const freeTrialUsed = usedByPhone || usedByName;
  const blockReason: AdAllowance['free_block_reason'] =
    usedByPhone && usedByName ? 'both' : usedByPhone ? 'phone' : usedByName ? 'name' : null;

  return {
    allowed: !freeTrialUsed,
    package_name: 'مجاني',
    subscription_code: null,
    max_ads: 1,
    used_ads: freeTrialUsed ? Math.max(activeClientAds.length, 1) : 0,
    duration_days: freeDays,
    is_permanent: false,
    featured: false,
    priority_rank: 0,
    allow_extra_images: false,
    allow_banner: false,
    free_trial_used: freeTrialUsed,
    free_block_reason: blockReason,
  };
}

export async function fetchClientPortal(query: string): Promise<ClientPortalData> {
  const clean = query.trim();
  if (!clean) return { subscription: null, payments: [], ads: [] };

  if (supabase) {
    const { data, error } = await supabase.rpc('get_elanati_client_portal', {
      p_query: clean,
    });
    if (!error && data) {
      const payload = data as {
        subscription: PackageRequest | null;
        payments?: PackageRequest[];
        ads: any[];
      };
      const payments = Array.isArray(payload.payments)
        ? payload.payments
        : payload.subscription
        ? [payload.subscription]
        : [];
      return {
        subscription: payload.subscription || null,
        payments,
        ads: Array.isArray(payload.ads) ? payload.ads.map(normalizeAdRow) : [],
      };
    }
  }

  const digits = normalizeDigits(clean);
  const upper = clean.toUpperCase();
  const requests = readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
  const matchingReqs = requests
    .filter(
      (r) =>
        (r.subscription_code && r.subscription_code.toUpperCase() === upper) ||
        (digits && normalizeDigits(r.client_phone) === digits)
    )
    .sort((a, b) => {
      if (a.status === 'activated' && b.status !== 'activated') return -1;
      if (b.status === 'activated' && a.status !== 'activated') return 1;
      return b.created_at.localeCompare(a.created_at);
    });

  const subscription = matchingReqs[0] || null;
  const phoneLookup = subscription ? normalizeDigits(subscription.client_phone) : digits;
  const ads = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  const clientAds = ads
    .filter(
      (a) =>
        (subscription?.subscription_code &&
          (a.subscription_code || '').toUpperCase() ===
            subscription.subscription_code.toUpperCase()) ||
        (phoneLookup && normalizeDigits(a.contact) === phoneLookup)
    )
    .map(normalizeAdRow)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const payments = [...matchingReqs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { subscription, payments, ads: clientAds };
}

// ============================================================================
// Advertisements
// ============================================================================
export async function fetchPublicAds(): Promise<Ad[]> {
  const nowIso = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_ads')
      .select('*')
      .eq('status', 'approved')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('priority_rank', { ascending: false })
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data.map(normalizeAdRow).filter((ad) => !isAdExpired(ad));
    }
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  let changed = false;
  const archivedSynced = all.map((rawAd) => {
    const ad = normalizeAdRow(rawAd);
    if (ad.status === 'approved' && isAdExpired(ad)) {
      changed = true;
      return { ...ad, status: 'archived' as AdStatus, updated_at: nowIso };
    }
    return ad;
  });
  if (changed) {
    writeLocal(STORAGE_KEYS.ads, archivedSynced);
  }

  return archivedSynced
    .filter((ad) => ad.status === 'approved' && !isAdExpired(ad))
    .sort((a, b) => {
      const rankDiff = (b.priority_rank || 0) - (a.priority_rank || 0);
      if (rankDiff !== 0) return rankDiff;
      const featDiff = Number(b.featured) - Number(a.featured);
      if (featDiff !== 0) return featDiff;
      return b.created_at.localeCompare(a.created_at);
    });
}

export async function fetchAllAdsAdmin(): Promise<Ad[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_ads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(normalizeAdRow);
  }
  return readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS).map(normalizeAdRow);
}

export interface CreateAdInput {
  client_name?: string;
  title: string;
  category: AdCategory;
  description: string;
  contact: string;
  city: string;
  image: string;
  image_url?: string;
  extra_images?: string[];
  banner_url?: string;
  package_name?: string;
  subscription_code?: string;
  duration_days?: number | null;
  requireApproval?: boolean;
  asAdmin?: boolean;
  featured?: boolean;
}

export async function createAd(input: CreateAdInput): Promise<{ ad: Ad; requiresReview: boolean }> {
  const settings = await fetchSiteSettings();
  const now = new Date();
  const nowIso = now.toISOString();

  let allowance: AdAllowance | null = null;
  if (!input.asAdmin) {
    allowance = await checkAdAllowance(input.contact, input.subscription_code, input.client_name);
    if (!allowance.allowed) {
      if (allowance.package_name === 'مجاني') {
        if (allowance.free_block_reason === 'both') {
          throw new Error(
            'تم استخدام الإعلان المجاني مسبقاً لهذا الرقم واسم المعلن. الباقة المجانية متاحة لمرة واحدة فقط، يمكنك الترقية إلى الباقة الاحترافية أو المؤسسية لإضافة إعلانات جديدة.'
          );
        }
        if (allowance.free_block_reason === 'name') {
          throw new Error(
            'اسم المعلن هذا استخدم الإعلان المجاني من قبل. الباقة المجانية متاحة لمرة واحدة فقط، يمكنك الترقية إلى الباقة الاحترافية أو المؤسسية لإضافة إعلانات جديدة.'
          );
        }
        throw new Error(
          'رقم الموبايل هذا استخدم الإعلان المجاني من قبل. الباقة المجانية متاحة لمرة واحدة فقط، يمكنك الترقية إلى الباقة الاحترافية أو المؤسسية لإضافة إعلانات جديدة.'
        );
      }
      throw new Error(
        `لقد وصلت للحد الأقصى لإعلانات باقتك (${allowance.max_ads} إعلانات). يمكنك الترقية إلى الباقة المؤسسية لإعلانات غير محدودة.`
      );
    }
  }

  const effectivePackage = input.asAdmin
    ? input.package_name || 'مجاني'
    : allowance?.package_name || 'مجاني';

  let expiresAt: string | null = null;
  if (input.asAdmin) {
    if (input.duration_days === null) {
      expiresAt = null;
    } else if (typeof input.duration_days === 'number' && input.duration_days > 0) {
      expiresAt = addDaysIso(now, input.duration_days);
    } else if (effectivePackage === 'مجاني') {
      expiresAt = addDaysIso(now, settings.free_ad_days || 7);
    } else if (effectivePackage === 'الاحترافي') {
      expiresAt = addDaysIso(now, settings.pro_ad_days || 30);
    } else {
      expiresAt = null;
    }
  } else if (allowance) {
    if (allowance.is_permanent || allowance.duration_days === null) {
      expiresAt = null;
    } else if (allowance.subscription_expires_at && allowance.package_name !== 'مجاني') {
      expiresAt = allowance.subscription_expires_at;
    } else {
      expiresAt = addDaysIso(now, allowance.duration_days);
    }
  }

  const isFeatured = input.asAdmin
    ? Boolean(input.featured)
    : Boolean(allowance?.featured);

  const priorityRank = input.asAdmin
    ? effectivePackage === 'المؤسسي'
      ? 2
      : effectivePackage === 'الاحترافي' || isFeatured
      ? 1
      : 0
    : allowance?.priority_rank || 0;

  const extraImages = (input.extra_images || []).map((u) => u.trim()).filter(Boolean).slice(0, 4);
  const bannerUrl =
    input.asAdmin || allowance?.allow_banner ? input.banner_url?.trim() || null : null;

  const requiresReview = input.asAdmin ? false : (input.requireApproval ?? settings.require_ad_approval);
  const status: AdStatus = requiresReview ? 'pending' : 'approved';

  const cleanCategory = input.category.trim().replace(/\s+/g, ' ');
  if (cleanCategory.length < 2) {
    throw new Error('يرجى اختيار أو كتابة اسم تصنيف صحيح');
  }

  const newAd: Ad = {
    id: generateId('ad'),
    client_name: input.client_name?.trim() || null,
    title: input.title.trim(),
    category: cleanCategory,
    description: input.description.trim(),
    contact: input.contact.trim(),
    whatsapp: normalizePhoneToWhatsApp(input.contact.trim()),
    city: input.city.trim(),
    image: input.image || '📦',
    image_url: input.image_url?.trim() || null,
    extra_images: input.asAdmin || allowance?.allow_extra_images ? extraImages : [],
    banner_url: bannerUrl,
    package_name: effectivePackage,
    subscription_code: allowance?.subscription_code || input.subscription_code || null,
    priority_rank: priorityRank,
    status,
    featured: isFeatured,
    views_count: 0,
    starts_at: nowIso,
    expires_at: expiresAt,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    await addCategory(cleanCategory);
  } catch {
    // non-fatal if categories table hasn't been created yet
  }

  if (supabase) {
    const { error } = await supabase.from('elanati_ads').insert({
      id: newAd.id,
      client_name: newAd.client_name,
      title: newAd.title,
      category: newAd.category,
      description: newAd.description,
      contact: newAd.contact,
      whatsapp: newAd.whatsapp,
      city: newAd.city,
      image: newAd.image,
      image_url: newAd.image_url,
      extra_images: newAd.extra_images,
      banner_url: newAd.banner_url,
      package_name: newAd.package_name,
      subscription_code: newAd.subscription_code,
      priority_rank: newAd.priority_rank,
      status: newAd.status,
      featured: newAd.featured,
      views_count: 0,
      starts_at: newAd.starts_at,
      expires_at: newAd.expires_at,
    });
    if (error) throw new Error(error.message);
    return { ad: newAd, requiresReview };
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(STORAGE_KEYS.ads, [newAd, ...all]);
  return { ad: newAd, requiresReview };
}

export async function updateAdAdmin(id: string, patch: Partial<Ad>): Promise<Ad> {
  const cleanCategory = patch.category ? patch.category.trim().replace(/\s+/g, ' ') : undefined;
  if (cleanCategory) {
    try {
      await addCategory(cleanCategory);
    } catch {
      // non-fatal
    }
  }

  const updatedPatch = {
    ...patch,
    ...(cleanCategory ? { category: cleanCategory } : {}),
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_ads')
      .update(updatedPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return normalizeAdRow(data);
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  let target: Ad | undefined;
  const next = all.map((ad) => {
    if (ad.id === id) {
      target = normalizeAdRow({ ...ad, ...updatedPatch });
      return target;
    }
    return ad;
  });
  writeLocal(STORAGE_KEYS.ads, next);
  if (!target) throw new Error('الإعلان غير موجود');
  return target;
}

export async function editAdByClient(input: {
  adId: string;
  ownerQuery: string;
  title: string;
  category: string;
  city: string;
  description: string;
  image?: string;
  image_url?: string;
}): Promise<Ad> {
  const cleanCat = input.category.trim().replace(/\s+/g, ' ');
  if (cleanCat.length < 2) {
    throw new Error('يرجى اختيار أو كتابة اسم تصنيف صحيح');
  }

  if (supabase) {
    const { data, error } = await supabase.rpc('edit_elanati_ad_by_client', {
      p_ad_id: input.adId,
      p_query: input.ownerQuery.trim(),
      p_title: input.title.trim(),
      p_category: cleanCat,
      p_city: input.city.trim(),
      p_description: input.description.trim(),
      p_image: input.image || null,
      p_image_url: input.image_url?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return normalizeAdRow(data);
  }

  try {
    await addCategory(cleanCat);
  } catch {
    // ignore
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  const queryDigits = normalizeDigits(input.ownerQuery);
  const queryUpper = input.ownerQuery.trim().toUpperCase();
  const nowIso = new Date().toISOString();

  let updatedAd: Ad | undefined;
  const next = all.map((raw) => {
    const ad = normalizeAdRow(raw);
    if (ad.id !== input.adId) return ad;

    const owns =
      (queryDigits && normalizeDigits(ad.contact) === queryDigits) ||
      (ad.subscription_code && ad.subscription_code.toUpperCase() === queryUpper);
    if (!owns) {
      throw new Error('غير مصرح بتعديل هذا الإعلان بهذا الرقم أو الكود');
    }
    if ((ad.client_edits_count || 0) >= 1) {
      throw new Error(
        'تم استهلاك التعديل الوحيد المتاح للمعلن. لطلب أي تعديل إضافي يرجى التواصل مع إدارة المنصة.'
      );
    }

    updatedAd = normalizeAdRow({
      ...ad,
      title: input.title.trim(),
      category: cleanCat,
      city: input.city.trim(),
      description: input.description.trim(),
      image: input.image || ad.image,
      image_url: input.image_url?.trim() || null,
      client_edits_count: (ad.client_edits_count || 0) + 1,
      last_client_edited_at: nowIso,
      updated_at: nowIso,
    });
    return updatedAd;
  });

  if (!updatedAd) throw new Error('الإعلان غير موجود');
  writeLocal(STORAGE_KEYS.ads, next);
  return updatedAd;
}

export async function deleteAdAdmin(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('elanati_ads').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(
    STORAGE_KEYS.ads,
    all.filter((ad) => ad.id !== id)
  );
}

export async function incrementAdViews(id: string): Promise<void> {
  if (supabase) {
    await supabase.rpc('increment_elanati_ad_views', { p_ad_id: id });
    return;
  }
  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(
    STORAGE_KEYS.ads,
    all.map((ad) => (ad.id === id ? { ...ad, views_count: (ad.views_count || 0) + 1 } : ad))
  );
}

// ============================================================================
// Contact Tickets & Bidirectional Support Messages (Client <-> Admin)
// ============================================================================
export interface CreateTicketInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  ad_id?: string | null;
}

export async function createContactTicket(input: CreateTicketInput): Promise<ContactMessage> {
  const ticketCode = generateTicketCode();
  const now = new Date().toISOString();

  // Check if client has active paid plan for priority support
  let hasPriority = false;
  if (input.phone) {
    try {
      const portal = await fetchClientPortal(input.phone);
      if (portal.subscription?.status === 'activated') {
        hasPriority = true;
      }
    } catch {
      // ignore
    }
  }

  const ticket: ContactMessage = {
    id: generateId('msg'),
    ticket_code: ticketCode,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    subject: input.subject?.trim() || 'استفسار عام',
    message: input.message.trim(),
    ad_id: input.ad_id || null,
    status: 'new',
    priority: hasPriority,
    admin_reply: null,
    replied_at: null,
    created_at: now,
  };

  const initialThreadMsg: SupportMessage = {
    id: generateId('sm'),
    ticket_code: ticketCode,
    sender_role: 'client',
    sender_name: ticket.name,
    body: ticket.message,
    created_at: now,
  };

  if (supabase) {
    const { error: msgErr } = await supabase.from('elanati_contact_messages').insert({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      name: ticket.name,
      email: ticket.email,
      phone: ticket.phone,
      subject: ticket.subject,
      message: ticket.message,
      ad_id: ticket.ad_id,
      priority: hasPriority,
      status: 'new',
    });
    if (msgErr) throw new Error(msgErr.message);

    const { error: threadErr } = await supabase.from('elanati_support_messages').insert({
      id: initialThreadMsg.id,
      ticket_code: initialThreadMsg.ticket_code,
      sender_role: 'client',
      sender_name: initialThreadMsg.sender_name,
      body: initialThreadMsg.body,
    });
    if (threadErr) throw new Error(threadErr.message);

    try {
      await supabase.rpc('send_elanati_internal_auto_reply', {
        p_ticket_code: ticket.ticket_code,
        p_client_name: ticket.name,
        p_client_phone: ticket.phone || null,
      });
    } catch {
      // ignore if function not yet created
    }

    return ticket;
  }

  const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
  writeLocal(STORAGE_KEYS.messages, [ticket, ...msgs]);

  const support = readLocal<SupportMessage[]>(STORAGE_KEYS.support, []);
  const nextSupport: SupportMessage[] = [...support, initialThreadMsg];

  // Local automatic intelligent reply inside the platform ($0 external cost)
  try {
    const portal: ClientPortalData = input.phone
      ? await fetchClientPortal(input.phone)
      : { subscription: null, payments: [], ads: [] };
    const cfg = await fetchAutomationConfigAdmin();
    const matchedSub = portal.subscription;
    const matchedAd = portal.ads[0];
    const clientName = matchedAd?.client_name || matchedSub?.client_name || ticket.name || 'عميلنا العزيز';

    let autoBody = '';
    if (matchedSub && matchedSub.status === 'activated' && matchedSub.expires_at) {
      const remDays = Math.max(1, getRemainingDays(matchedSub.expires_at) || 1);
      autoBody = renderWhatsAppTemplate(cfg.paid_expiry_template, {
        الاسم: clientName,
        الباقة: matchedSub.package_name,
        كود_الاشتراك: matchedSub.subscription_code || '-',
        الأيام_المتبقية: remDays,
        تاريخ_الانتهاء: matchedSub.expires_at.split('T')[0],
      });
    } else if (matchedAd) {
      autoBody = renderWhatsAppTemplate(cfg.free_expiry_template, {
        الاسم: clientName,
        عنوان_الإعلان: matchedAd.title,
        المشاهدات: matchedAd.views_count || 0,
        تاريخ_الانتهاء: matchedAd.expires_at ? matchedAd.expires_at.split('T')[0] : 'دائم',
      });
    } else {
      autoBody = `أهلاً أستاذ ${clientName}، مع حضرتك إدارة منصة إعلاناتي 👋\nتم استلام رسالتك برقم المتابعة ${ticket.ticket_code}.\nيمكنك نشر إعلانك الأول مجاناً لمدة 7 أيام، أو الاشتراك في الباقة الاحترافية بـ 249 جنيه فقط (حتى 10 إعلانات + ظهور 30 يوم + تمييز نجمي) عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nسيتابع معك فريق الإدارة فوراً على نفس المحادثة.`;
    }

    nextSupport.push({
      id: generateId('sm'),
      ticket_code: ticket.ticket_code,
      sender_role: 'admin',
      sender_name: 'الرد الآلي — إدارة إعلاناتي',
      body: autoBody,
      created_at: new Date(Date.now() + 500).toISOString(),
    });
  } catch {
    // ignore
  }

  writeLocal(STORAGE_KEYS.support, nextSupport);

  return ticket;
}

export async function fetchTicketByCode(
  ticketCode: string
): Promise<{ ticket: ContactMessage | null; messages: SupportMessage[] }> {
  const cleanCode = ticketCode.trim().toUpperCase();
  if (!cleanCode) return { ticket: null, messages: [] };

  if (supabase) {
    const [ticketRes, msgsRes] = await Promise.all([
      supabase.rpc('get_elanati_ticket_by_code', { p_ticket_code: cleanCode }),
      supabase.rpc('get_elanati_ticket_messages', { p_ticket_code: cleanCode }),
    ]);

    const ticketRow = Array.isArray(ticketRes.data) ? ticketRes.data[0] : ticketRes.data;
    if (!ticketRow) return { ticket: null, messages: [] };

    return {
      ticket: {
        id: ticketRow.id,
        ticket_code: ticketRow.ticket_code,
        name: ticketRow.name,
        email: '',
        subject: ticketRow.subject,
        message: ticketRow.message,
        status: ticketRow.status,
        admin_reply: ticketRow.admin_reply,
        replied_at: ticketRow.replied_at,
        created_at: ticketRow.created_at,
      },
      messages: (msgsRes.data || []) as SupportMessage[],
    };
  }

  const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
  const ticket = msgs.find((m) => m.ticket_code.toUpperCase() === cleanCode) || null;
  const support = readLocal<SupportMessage[]>(STORAGE_KEYS.support, []);
  const thread = support
    .filter((s) => s.ticket_code.toUpperCase() === cleanCode)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ticket, messages: thread };
}

export async function postSupportMessage(input: {
  ticket_code: string;
  sender_role: 'client' | 'admin';
  sender_name: string;
  body: string;
}): Promise<SupportMessage> {
  const cleanCode = input.ticket_code.trim().toUpperCase();
  const msg: SupportMessage = {
    id: generateId('sm'),
    ticket_code: cleanCode,
    sender_role: input.sender_role,
    sender_name: input.sender_name.trim(),
    body: input.body.trim(),
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from('elanati_support_messages').insert({
      id: msg.id,
      ticket_code: msg.ticket_code,
      sender_role: msg.sender_role,
      sender_name: msg.sender_name,
      body: msg.body,
    });
    if (error) throw new Error(error.message);

    if (input.sender_role === 'admin') {
      await supabase
        .from('elanati_contact_messages')
        .update({
          status: 'replied',
          admin_reply: msg.body,
          replied_at: msg.created_at,
        })
        .eq('ticket_code', cleanCode);
    }
    return msg;
  }

  const support = readLocal<SupportMessage[]>(STORAGE_KEYS.support, []);
  writeLocal(STORAGE_KEYS.support, [...support, msg]);

  if (input.sender_role === 'admin') {
    const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
    writeLocal(
      STORAGE_KEYS.messages,
      msgs.map((m) =>
        m.ticket_code.toUpperCase() === cleanCode
          ? { ...m, status: 'replied', admin_reply: msg.body, replied_at: msg.created_at }
          : m
      )
    );
  } else {
    const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
    writeLocal(
      STORAGE_KEYS.messages,
      msgs.map((m) =>
        m.ticket_code.toUpperCase() === cleanCode && m.status === 'replied'
          ? { ...m, status: 'in_progress' }
          : m
      )
    );
  }
  return msg;
}

export async function fetchAllTicketsAdmin(): Promise<ContactMessage[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_contact_messages')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as ContactMessage[];
  }
  return readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
}

export async function fetchTicketMessagesAdmin(ticketCode: string): Promise<SupportMessage[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_support_messages')
      .select('*')
      .eq('ticket_code', ticketCode)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as SupportMessage[];
  }
  const support = readLocal<SupportMessage[]>(STORAGE_KEYS.support, []);
  return support
    .filter((s) => s.ticket_code.toUpperCase() === ticketCode.toUpperCase())
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateTicketStatusAdmin(id: string, status: TicketStatus): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('elanati_contact_messages')
      .update({ status })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
  writeLocal(
    STORAGE_KEYS.messages,
    msgs.map((m) => (m.id === id ? { ...m, status } : m))
  );
}

// ============================================================================
// Package Requests & Subscriptions
// ============================================================================
export async function createPackageRequest(input: {
  package_name: string;
  billing_cycle: 'monthly' | 'annual';
  price_egp: number;
  payment_method: PaymentMethod;
  payment_reference?: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  company_name?: string;
  notes?: string;
}): Promise<PackageRequest> {
  const isEnterprise = input.package_name === 'المؤسسي';
  const maxAds = isEnterprise ? 999999 : 10;
  const subscriptionCode = generateSubscriptionCode();

  const req: PackageRequest = {
    id: generateId('preq'),
    subscription_code: subscriptionCode,
    package_name: input.package_name,
    billing_cycle: input.billing_cycle,
    price_egp: input.price_egp,
    payment_method: input.payment_method,
    payment_reference: input.payment_reference?.trim() || null,
    client_name: input.client_name.trim(),
    client_phone: input.client_phone.trim(),
    client_email: input.client_email?.trim() || null,
    company_name: input.company_name?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'pending',
    max_ads: maxAds,
    starts_at: null,
    expires_at: null,
    api_key: null,
    account_manager_name: null,
    account_manager_phone: null,
    admin_note: null,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from('elanati_package_requests').insert({
      id: req.id,
      subscription_code: req.subscription_code,
      package_name: req.package_name,
      billing_cycle: req.billing_cycle,
      price_egp: req.price_egp,
      payment_method: req.payment_method,
      payment_reference: req.payment_reference,
      client_name: req.client_name,
      client_phone: req.client_phone,
      client_email: req.client_email,
      company_name: req.company_name,
      notes: req.notes,
      status: 'pending',
      max_ads: req.max_ads,
    });
    if (error) throw new Error(error.message);
    return req;
  }

  const all = readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
  writeLocal(STORAGE_KEYS.packageRequests, [req, ...all]);
  return req;
}

export async function fetchPackageRequestsAdmin(): Promise<PackageRequest[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_package_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as PackageRequest[];
  }
  return readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
}

export async function updatePackageRequestAdmin(
  id: string,
  patch: Partial<PackageRequest>
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('elanati_package_requests')
      .update(patch)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const all = readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
  writeLocal(
    STORAGE_KEYS.packageRequests,
    all.map((r) => (r.id === id ? { ...r, ...patch } : r))
  );
}

export async function activateSubscriptionAdmin(
  req: PackageRequest,
  durationDays?: number
): Promise<void> {
  const settings = await fetchSiteSettings();
  const now = new Date();
  const days =
    durationDays ?? (req.billing_cycle === 'annual' ? 365 : 30);
  const startsAt = now.toISOString();
  const expiresAt = addDaysIso(now, days);
  const isEnterprise = req.package_name === 'المؤسسي';
  const subCode = req.subscription_code || generateSubscriptionCode();
  const apiKey =
    req.api_key || (isEnterprise ? `ELN-API-${Math.random().toString(36).slice(2, 10).toUpperCase()}` : null);

  const patch: Partial<PackageRequest> = {
    subscription_code: subCode,
    status: 'activated',
    starts_at: startsAt,
    expires_at: expiresAt,
    max_ads: isEnterprise ? 999999 : 10,
    api_key: apiKey,
    account_manager_name: isEnterprise ? 'مدير حسابات الشركات - إعلاناتي' : null,
    account_manager_phone: isEnterprise ? settings.contact_phone : null,
  };

  await updatePackageRequestAdmin(req.id, patch);

  // Upgrade existing active/pending ads for the same phone number
  const clientDigits = normalizeDigits(req.client_phone);
  const adExpiresAt = isEnterprise ? null : expiresAt;
  const priorityRank = isEnterprise ? 2 : 1;

  if (supabase) {
    const allAds = await fetchAllAdsAdmin();
    const matchingAds = allAds.filter(
      (a) =>
        a.status !== 'rejected' &&
        (normalizeDigits(a.contact) === clientDigits ||
          (a.subscription_code && a.subscription_code === subCode))
    );
    await Promise.all(
      matchingAds.map((ad) =>
        updateAdAdmin(ad.id, {
          client_name: ad.client_name || req.client_name,
          package_name: req.package_name,
          subscription_code: subCode,
          featured: true,
          priority_rank: priorityRank,
          expires_at: adExpiresAt,
          status: ad.status === 'pending' ? 'approved' : ad.status,
        })
      )
    );
    return;
  }

  const allAds = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(
    STORAGE_KEYS.ads,
    allAds.map((ad) =>
      ad.status !== 'rejected' && normalizeDigits(ad.contact) === clientDigits
        ? {
            ...ad,
            client_name: ad.client_name || req.client_name,
            package_name: req.package_name,
            subscription_code: subCode,
            featured: true,
            priority_rank: priorityRank,
            expires_at: adExpiresAt,
            status: ad.status === 'pending' ? 'approved' : ad.status,
          }
        : ad
    )
  );
}

export async function extendSubscriptionAdmin(
  req: PackageRequest,
  extraDays: number
): Promise<void> {
  const settings = await fetchSiteSettings();
  const now = new Date();
  const baseDate =
    req.expires_at && new Date(req.expires_at).getTime() > now.getTime()
      ? new Date(req.expires_at)
      : now;
  const newExpiresAt = addDaysIso(baseDate, extraDays);
  const startsAt = req.starts_at || now.toISOString();
  const isEnterprise = req.package_name === 'المؤسسي';
  const subCode = req.subscription_code || generateSubscriptionCode();

  await updatePackageRequestAdmin(req.id, {
    subscription_code: subCode,
    status: 'activated',
    starts_at: startsAt,
    expires_at: newExpiresAt,
    account_manager_name: isEnterprise ? req.account_manager_name || 'مدير حسابات الشركات - إعلاناتي' : null,
    account_manager_phone: isEnterprise ? req.account_manager_phone || settings.contact_phone : null,
  });

  const clientDigits = normalizeDigits(req.client_phone);
  const adExpiresAt = isEnterprise ? null : newExpiresAt;
  const priorityRank = isEnterprise ? 2 : 1;

  if (supabase) {
    const allAds = await fetchAllAdsAdmin();
    const matchingAds = allAds.filter(
      (a) =>
        a.status !== 'rejected' &&
        (normalizeDigits(a.contact) === clientDigits ||
          (a.subscription_code && a.subscription_code === subCode))
    );
    await Promise.all(
      matchingAds.map((ad) =>
        updateAdAdmin(ad.id, {
          package_name: req.package_name,
          subscription_code: subCode,
          featured: true,
          priority_rank: priorityRank,
          expires_at: adExpiresAt,
          status: ad.status === 'archived' || ad.status === 'pending' ? 'approved' : ad.status,
        })
      )
    );
    return;
  }

  const allAds = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(
    STORAGE_KEYS.ads,
    allAds.map((ad) =>
      ad.status !== 'rejected' &&
      (normalizeDigits(ad.contact) === clientDigits ||
        (ad.subscription_code && ad.subscription_code === subCode))
        ? {
            ...ad,
            package_name: req.package_name,
            subscription_code: subCode,
            featured: true,
            priority_rank: priorityRank,
            expires_at: adExpiresAt,
            status: ad.status === 'archived' || ad.status === 'pending' ? 'approved' : ad.status,
          }
        : ad
    )
  );
}

// ============================================================================
// Packages & Testimonials (Dynamic CMS)
// ============================================================================
export async function fetchPackages(): Promise<PackagePlan[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_packages')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      })) as PackagePlan[];
    }
  }
  return readLocal<PackagePlan[]>(STORAGE_KEYS.packages, INITIAL_PACKAGES);
}

export async function updatePackageAdmin(id: string, patch: Partial<PackagePlan>): Promise<PackagePlan> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_packages')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PackagePlan;
  }
  const all = readLocal<PackagePlan[]>(STORAGE_KEYS.packages, INITIAL_PACKAGES);
  let updated: PackagePlan | undefined;
  const next = all.map((p) => {
    if (p.id === id) {
      updated = { ...p, ...patch };
      return updated;
    }
    return p;
  });
  writeLocal(STORAGE_KEYS.packages, next);
  if (!updated) throw new Error('الباقة غير موجودة');
  return updated;
}

export async function fetchTestimonials(includeHidden = false): Promise<Testimonial[]> {
  if (supabase) {
    let query = supabase
      .from('elanati_testimonials')
      .select('*')
      .order('created_at', { ascending: false });
    if (!includeHidden) {
      query = query.eq('is_visible', true);
    }
    const { data, error } = await query;
    if (!error && data) {
      return data as Testimonial[];
    }
  }
  const all = readLocal<Testimonial[]>(STORAGE_KEYS.testimonials, INITIAL_TESTIMONIALS);
  return includeHidden ? all : all.filter((t) => t.is_visible);
}

export async function createTestimonialAdmin(
  input: Omit<Testimonial, 'id' | 'created_at'>
): Promise<Testimonial> {
  const item: Testimonial = {
    ...input,
    id: generateId('test'),
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_testimonials')
      .insert({
        name: item.name,
        role: item.role,
        city: item.city,
        text: item.text,
        rating: item.rating,
        avatar: item.avatar,
        is_visible: item.is_visible,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Testimonial;
  }

  const all = readLocal<Testimonial[]>(STORAGE_KEYS.testimonials, INITIAL_TESTIMONIALS);
  writeLocal(STORAGE_KEYS.testimonials, [item, ...all]);
  return item;
}

export async function updateTestimonialAdmin(
  id: string,
  patch: Partial<Testimonial>
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('elanati_testimonials').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const all = readLocal<Testimonial[]>(STORAGE_KEYS.testimonials, INITIAL_TESTIMONIALS);
  writeLocal(
    STORAGE_KEYS.testimonials,
    all.map((t) => (t.id === id ? { ...t, ...patch } : t))
  );
}

export async function deleteTestimonialAdmin(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('elanati_testimonials').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const all = readLocal<Testimonial[]>(STORAGE_KEYS.testimonials, INITIAL_TESTIMONIALS);
  writeLocal(
    STORAGE_KEYS.testimonials,
    all.filter((t) => t.id !== id)
  );
}

// ============================================================================
// Admin Authentication
// ============================================================================
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured || !supabase) {
    const saved = readLocal<AdminSession | null>(STORAGE_KEYS.previewAdmin, null);
    return saved;
  }

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || !user.email) return null;

  const { data: adminRow } = await supabase
    .from('elanati_admins')
    .select('email, full_name')
    .ilike('email', user.email)
    .maybeSingle();

  if (!adminRow) return null;

  return {
    email: adminRow.email,
    fullName: adminRow.full_name || 'مدير المنصة',
    isPreviewMode: false,
  };
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured || !supabase) {
    if (!cleanEmail || password.length < 4) {
      throw new Error('أدخل البريد الإلكتروني وكلمة مرور صالحة');
    }
    const previewSession: AdminSession = {
      email: cleanEmail,
      fullName: 'مدير المنصة',
      isPreviewMode: true,
    };
    writeLocal(STORAGE_KEYS.previewAdmin, previewSession);
    return previewSession;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) {
    if (error.message === 'Invalid login credentials') {
      throw new Error('بيانات الدخول غير صحيحة');
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error('يرجى تأكيد البريد الإلكتروني أولاً قبل تسجيل الدخول');
    }
    throw new Error(error.message);
  }
  if (!data.user?.email) {
    throw new Error('تعذر التحقق من حساب المدير');
  }

  const { data: adminRow, error: adminErr } = await supabase
    .from('elanati_admins')
    .select('email, full_name')
    .ilike('email', data.user.email)
    .maybeSingle();

  if (adminErr || !adminRow) {
    await supabase.auth.signOut();
    throw new Error('هذا الحساب غير مسجل ضمن صلاحيات مديري المنصة');
  }

  return {
    email: adminRow.email,
    fullName: adminRow.full_name || 'مدير المنصة',
    isPreviewMode: false,
  };
}

export async function signUpFirstAdmin(
  email: string,
  password: string
): Promise<{ needsEmailConfirmation: boolean; session: AdminSession | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured || !supabase) {
    const session = await signInAdmin(cleanEmail, password);
    return { needsEmailConfirmation: false, session };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  });
  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      throw new Error('هذا البريد مسجل بالفعل — استخدم خيار تسجيل الدخول بنفس كلمة المرور.');
    }
    throw new Error(error.message);
  }

  if (!data.session) {
    return { needsEmailConfirmation: true, session: null };
  }

  const session = await getAdminSession();
  if (!session) {
    await supabase.auth.signOut();
    throw new Error('تم إنشاء الحساب ولكن البريد غير مدرج ضمن مديري المنصة.');
  }
  return { needsEmailConfirmation: false, session };
}

export async function signOutAdmin(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(STORAGE_KEYS.previewAdmin);
}

// ============================================================================
// Full Automation (Auto-Archiving Expired Ads & Automated WhatsApp Alerts)
// ============================================================================
export function renderWhatsAppTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val));
  }
  return out;
}

export async function archiveExpiredAdsAdmin(): Promise<number> {
  const nowIso = new Date().toISOString();

  if (supabase) {
    const { data: rpcCount, error: rpcErr } = await supabase.rpc('archive_expired_elanati_ads');
    if (!rpcErr && typeof rpcCount === 'number') {
      return rpcCount;
    }

    const { data: expiredAds } = await supabase
      .from('elanati_ads')
      .select('id')
      .eq('status', 'approved')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);

    if (expiredAds && expiredAds.length > 0) {
      const ids = expiredAds.map((a: any) => a.id);
      const { error } = await supabase
        .from('elanati_ads')
        .update({ status: 'archived', updated_at: nowIso })
        .in('id', ids);
      if (!error) return ids.length;
    }
    return 0;
  }

  const ads = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  const requests = readLocal<PackageRequest[]>(STORAGE_KEYS.packageRequests, []);
  let archivedCount = 0;

  const updated = ads.map((ad) => {
    if (ad.status !== 'approved') return ad;
    const subExpired =
      ad.subscription_code &&
      ad.package_name !== 'المؤسسي' &&
      requests.some(
        (r) =>
          r.subscription_code &&
          r.subscription_code.toUpperCase() === ad.subscription_code!.toUpperCase() &&
          (r.status === 'cancelled' || (r.expires_at && new Date(r.expires_at).getTime() <= Date.now()))
      );
    if (isAdExpired(ad) || subExpired) {
      archivedCount++;
      return { ...ad, status: 'archived' as AdStatus, updated_at: nowIso };
    }
    return ad;
  });

  if (archivedCount > 0) {
    writeLocal(STORAGE_KEYS.ads, updated);
  }
  return archivedCount;
}

export async function fetchAutomationConfigAdmin(): Promise<AutomationConfig> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_automation_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      return {
        ...DEFAULT_AUTOMATION_CONFIG,
        ...(data as Partial<AutomationConfig>),
      };
    }
  }
  return {
    ...DEFAULT_AUTOMATION_CONFIG,
    ...readLocal<Partial<AutomationConfig>>(
      STORAGE_KEYS.automationConfig,
      DEFAULT_AUTOMATION_CONFIG
    ),
  };
}

export async function updateAutomationConfigAdmin(
  patch: Partial<AutomationConfig>
): Promise<AutomationConfig> {
  const current = await fetchAutomationConfigAdmin();
  const updated: AutomationConfig = {
    ...current,
    ...patch,
    id: 1,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_automation_config')
      .upsert(updated)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...DEFAULT_AUTOMATION_CONFIG, ...(data as Partial<AutomationConfig>) };
  }

  writeLocal(STORAGE_KEYS.automationConfig, updated);
  return updated;
}

export async function fetchWhatsAppLogsAdmin(): Promise<WhatsAppLog[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_whatsapp_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (!error && data) {
      return data as WhatsAppLog[];
    }
    return [];
  }
  return readLocal<WhatsAppLog[]>(STORAGE_KEYS.whatsappLogs, []);
}

export async function findPendingAutomationTargetsAdmin(): Promise<AutomationTargetPreview[]> {
  const [ads, requests, config, logs] = await Promise.all([
    fetchAllAdsAdmin(),
    fetchPackageRequestsAdmin(),
    fetchAutomationConfigAdmin(),
    fetchWhatsAppLogsAdmin(),
  ]);

  const nowMs = Date.now();
  const sentSet = new Set(
    logs
      .filter((l) => l.delivery_status === 'sent')
      .map((l) => `${l.target_type}:${l.target_id}:${l.target_expires_at || ''}`)
  );

  const phoneToName = new Map<string, string>();
  for (const r of requests) {
    const d = normalizeDigits(r.client_phone);
    if (d && r.client_name && !phoneToName.has(d)) {
      phoneToName.set(d, r.client_name);
    }
  }

  const targets: AutomationTargetPreview[] = [];

  // 1) Free ads within reminder window (default 48h before expiry)
  const freeWindowMs = (config.free_reminder_hours_before || 48) * 60 * 60 * 1000;
  for (const ad of ads) {
    if (ad.status !== 'approved' || ad.package_name !== 'مجاني' || !ad.expires_at) continue;
    const expMs = new Date(ad.expires_at).getTime();
    if (expMs <= nowMs || expMs - nowMs > freeWindowMs) continue;

    const remHours = Math.max(1, Math.ceil((expMs - nowMs) / (1000 * 60 * 60)));
    const digits = normalizeDigits(ad.contact);
    const clientName = (ad.client_name && ad.client_name.trim()) || phoneToName.get(digits) || 'عميلنا العزيز';

    const messageBody = renderWhatsAppTemplate(config.free_expiry_template, {
      الاسم: clientName,
      عنوان_الإعلان: ad.title,
      المشاهدات: ad.views_count || 0,
      تاريخ_الانتهاء: ad.expires_at.split('T')[0],
    });

    const dedupeKey = `free_ad_expiry:${ad.id}:${ad.expires_at}`;
    const waDigits = normalizePhoneToWhatsApp(ad.whatsapp || ad.contact);

    targets.push({
      target_type: 'free_ad_expiry',
      target_id: ad.id,
      target_expires_at: ad.expires_at,
      client_name: clientName,
      client_phone: ad.contact,
      title: ad.title,
      views_count: ad.views_count || 0,
      remaining_label: remHours >= 24 ? `${Math.ceil(remHours / 24)} يوم (${remHours} ساعة)` : `${remHours} ساعة`,
      message_body: messageBody,
      already_sent: sentSet.has(dedupeKey),
      whatsapp_direct_url: `https://wa.me/${waDigits}?text=${encodeURIComponent(messageBody)}`,
    });
  }

  // 2) Paid subscriptions within reminder window (default 7 days / 1 week before expiry)
  const paidWindowMs = (config.paid_reminder_days_before || 7) * 24 * 60 * 60 * 1000;
  for (const sub of requests) {
    if (sub.status !== 'activated' || !sub.expires_at) continue;
    const expMs = new Date(sub.expires_at).getTime();
    if (expMs <= nowMs || expMs - nowMs > paidWindowMs) continue;

    const remDays = Math.max(1, Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24)));
    const clientName = (sub.client_name && sub.client_name.trim()) || 'عميلنا العزيز';

    const messageBody = renderWhatsAppTemplate(config.paid_expiry_template, {
      الاسم: clientName,
      الباقة: sub.package_name,
      كود_الاشتراك: sub.subscription_code || '-',
      الأيام_المتبقية: remDays,
      تاريخ_الانتهاء: sub.expires_at.split('T')[0],
    });

    const dedupeKey = `paid_sub_expiry:${sub.id}:${sub.expires_at}`;
    const waDigits = normalizePhoneToWhatsApp(sub.client_phone);

    targets.push({
      target_type: 'paid_sub_expiry',
      target_id: sub.id,
      target_expires_at: sub.expires_at,
      client_name: clientName,
      client_phone: sub.client_phone,
      title: `اشتراك ${sub.package_name} (${sub.subscription_code || ''})`,
      remaining_label: `${remDays} أيام (ينتهي ${sub.expires_at.split('T')[0]})`,
      message_body: messageBody,
      already_sent: sentSet.has(dedupeKey),
      whatsapp_direct_url: `https://wa.me/${waDigits}?text=${encodeURIComponent(messageBody)}`,
    });
  }

  return targets;
}

export async function runAutomationNowAdmin(): Promise<AutomationRunResult> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (token) {
      try {
        const res = await fetch('/api/cron/automation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const payload = (await res.json()) as AutomationRunResult & { error?: string };
          if (!res.ok) {
            throw new Error(payload.error || 'تعذر تشغيل الأتمتة');
          }
          return payload;
        }
      } catch (err: any) {
        if (err?.message && !String(err.message).includes('fetch')) {
          throw err;
        }
      }
    }

    const archivedCount = await archiveExpiredAdsAdmin();
    const summary = `أرشفة ${archivedCount} إعلان منتهي تلقائياً`;
    await updateAutomationConfigAdmin({
      last_run_at: new Date().toISOString(),
      last_run_summary: summary,
    });
    return {
      ok: true,
      archivedCount,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      summary,
    };
  }

  // Local preview mode simulation
  const archivedCount = await archiveExpiredAdsAdmin();
  const config = await fetchAutomationConfigAdmin();
  const targets = await findPendingAutomationTargetsAdmin();
  const dueTargets = targets.filter((t) => !t.already_sent);
  let sentCount = 0;

  if (config.auto_whatsapp_enabled && dueTargets.length > 0) {
    const existingLogs = readLocal<WhatsAppLog[]>(STORAGE_KEYS.whatsappLogs, []);
    const newLogs: WhatsAppLog[] = dueTargets.map((t) => {
      sentCount++;
      return {
        id: generateId('wa'),
        target_type: t.target_type,
        target_id: t.target_id,
        target_expires_at: t.target_expires_at,
        client_name: t.client_name,
        client_phone: t.client_phone,
        message_body: t.message_body,
        delivery_status: config.whatsapp_endpoint.trim() ? 'sent' : 'sent',
        provider_response: 'معاينة محلية',
        sent_at: new Date().toISOString(),
      };
    });
    writeLocal(STORAGE_KEYS.whatsappLogs, [...newLogs, ...existingLogs]);
  }

  const summary = `أرشفة ${archivedCount} إعلان منتهي · تجهيز/إرسال ${sentCount} رسالة واتساب`;
  await updateAutomationConfigAdmin({
    last_run_at: new Date().toISOString(),
    last_run_summary: summary,
  });

  return {
    ok: true,
    archivedCount,
    sentCount,
    failedCount: 0,
    skippedCount: targets.length - dueTargets.length,
    summary,
  };
}

export async function fetchPublicAutomationTemplates(): Promise<{
  free_reminder_hours_before: number;
  paid_reminder_days_before: number;
  free_expiry_template: string;
  paid_expiry_template: string;
}> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_elanati_public_templates');
      if (!error && data) {
        return {
          free_reminder_hours_before: data.free_reminder_hours_before || 48,
          paid_reminder_days_before: data.paid_reminder_days_before || 7,
          free_expiry_template:
            data.free_expiry_template || DEFAULT_AUTOMATION_CONFIG.free_expiry_template,
          paid_expiry_template:
            data.paid_expiry_template || DEFAULT_AUTOMATION_CONFIG.paid_expiry_template,
        };
      }
    } catch {
      // fallback
    }
  }
  const localCfg = readLocal<Partial<AutomationConfig>>(
    STORAGE_KEYS.automationConfig,
    DEFAULT_AUTOMATION_CONFIG
  );
  return {
    free_reminder_hours_before: localCfg.free_reminder_hours_before || 48,
    paid_reminder_days_before: localCfg.paid_reminder_days_before || 7,
    free_expiry_template:
      localCfg.free_expiry_template || DEFAULT_AUTOMATION_CONFIG.free_expiry_template,
    paid_expiry_template:
      localCfg.paid_expiry_template || DEFAULT_AUTOMATION_CONFIG.paid_expiry_template,
  };
}

export async function markDirectWhatsAppSentAdmin(target: AutomationTargetPreview): Promise<void> {
  const entry = {
    target_type: target.target_type,
    target_id: target.target_id,
    target_expires_at: target.target_expires_at,
    client_name: target.client_name,
    client_phone: target.client_phone,
    message_body: target.message_body,
    delivery_status: 'sent' as const,
    provider_response: 'إرسال مباشر مجاني من لوحة المدير',
  };

  if (supabase) {
    const { error } = await supabase.from('elanati_whatsapp_logs').insert(entry);
    if (error) throw new Error(error.message);
    return;
  }

  const existingLogs = readLocal<WhatsAppLog[]>(STORAGE_KEYS.whatsappLogs, []);
  const localLog: WhatsAppLog = {
    id: generateId('wa'),
    ...entry,
    sent_at: new Date().toISOString(),
  };
  writeLocal(STORAGE_KEYS.whatsappLogs, [localLog, ...existingLogs]);
}
