import {
  DEFAULT_SITE_SETTINGS,
  INITIAL_ADS,
  INITIAL_PACKAGES,
  INITIAL_TESTIMONIALS,
} from '../data/seedData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  Ad,
  AdCategory,
  AdStatus,
  AdminSession,
  ContactMessage,
  PackagePlan,
  PackageRequest,
  PackageRequestStatus,
  SiteSettings,
  SupportMessage,
  Testimonial,
  TicketStatus,
} from '../types';

const STORAGE_KEYS = {
  ads: 'elanati_local_ads_v1',
  messages: 'elanati_local_messages_v1',
  support: 'elanati_local_support_v1',
  packageRequests: 'elanati_local_pkg_requests_v1',
  packages: 'elanati_local_packages_v1',
  testimonials: 'elanati_local_testimonials_v1',
  settings: 'elanati_local_settings_v1',
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

function normalizePhoneToWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  return digits;
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
      return data as SiteSettings;
    }
  }
  return readLocal<SiteSettings>(STORAGE_KEYS.settings, DEFAULT_SITE_SETTINGS);
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
    return data as SiteSettings;
  }

  writeLocal(STORAGE_KEYS.settings, updated);
  return updated;
}

// ============================================================================
// Advertisements
// ============================================================================
export async function fetchPublicAds(): Promise<Ad[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_ads')
      .select('*')
      .eq('status', 'approved')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data as Ad[];
    }
  }
  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  return all
    .filter((ad) => ad.status === 'approved')
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

export async function fetchAllAdsAdmin(): Promise<Ad[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('elanati_ads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as Ad[];
  }
  return readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
}

export interface CreateAdInput {
  title: string;
  category: AdCategory;
  description: string;
  contact: string;
  city: string;
  image: string;
  image_url?: string;
  package_name?: string;
  requireApproval?: boolean;
  asAdmin?: boolean;
  featured?: boolean;
}

export async function createAd(input: CreateAdInput): Promise<{ ad: Ad; requiresReview: boolean }> {
  const requiresReview = input.asAdmin ? false : (input.requireApproval ?? true);
  const status: AdStatus = requiresReview ? 'pending' : 'approved';
  const now = new Date().toISOString();

  const newAd: Ad = {
    id: generateId('ad'),
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    contact: input.contact.trim(),
    whatsapp: normalizePhoneToWhatsApp(input.contact.trim()),
    city: input.city.trim(),
    image: input.image || '📦',
    image_url: input.image_url?.trim() || null,
    package_name: input.package_name || 'مجاني',
    status,
    featured: Boolean(input.featured),
    views_count: 0,
    created_at: now,
    updated_at: now,
  };

  if (supabase) {
    // Insert without .select() so public pending submissions don't trip SELECT RLS
    const { error } = await supabase.from('elanati_ads').insert({
      id: newAd.id,
      title: newAd.title,
      category: newAd.category,
      description: newAd.description,
      contact: newAd.contact,
      whatsapp: newAd.whatsapp,
      city: newAd.city,
      image: newAd.image,
      image_url: newAd.image_url,
      package_name: newAd.package_name,
      status: newAd.status,
      featured: newAd.featured,
      views_count: 0,
    });
    if (error) throw new Error(error.message);
    return { ad: newAd, requiresReview };
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  writeLocal(STORAGE_KEYS.ads, [newAd, ...all]);
  return { ad: newAd, requiresReview };
}

export async function updateAdAdmin(id: string, patch: Partial<Ad>): Promise<Ad> {
  const updatedPatch = {
    ...patch,
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
    return data as Ad;
  }

  const all = readLocal<Ad[]>(STORAGE_KEYS.ads, INITIAL_ADS);
  let target: Ad | undefined;
  const next = all.map((ad) => {
    if (ad.id === id) {
      target = { ...ad, ...updatedPatch };
      return target;
    }
    return ad;
  });
  writeLocal(STORAGE_KEYS.ads, next);
  if (!target) throw new Error('الإعلان غير موجود');
  return target;
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

    return ticket;
  }

  const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.messages, []);
  writeLocal(STORAGE_KEYS.messages, [ticket, ...msgs]);

  const support = readLocal<SupportMessage[]>(STORAGE_KEYS.support, []);
  writeLocal(STORAGE_KEYS.support, [...support, initialThreadMsg]);

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
// Package Requests
// ============================================================================
export async function createPackageRequest(input: {
  package_name: string;
  billing_cycle: 'monthly' | 'annual';
  price_egp: number;
  client_name: string;
  client_phone: string;
  client_email?: string;
  company_name?: string;
  notes?: string;
}): Promise<PackageRequest> {
  const req: PackageRequest = {
    id: generateId('preq'),
    package_name: input.package_name,
    billing_cycle: input.billing_cycle,
    price_egp: input.price_egp,
    client_name: input.client_name.trim(),
    client_phone: input.client_phone.trim(),
    client_email: input.client_email?.trim() || null,
    company_name: input.company_name?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'pending',
    admin_note: null,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from('elanati_package_requests').insert({
      id: req.id,
      package_name: req.package_name,
      billing_cycle: req.billing_cycle,
      price_egp: req.price_egp,
      client_name: req.client_name,
      client_phone: req.client_phone,
      client_email: req.client_email,
      company_name: req.company_name,
      notes: req.notes,
      status: 'pending',
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
  patch: { status?: PackageRequestStatus; admin_note?: string }
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
      throw new Error('أدخل البريد الإلكتروني وكلمة مرور صالحة (4 أحرف على الأقل)');
    }
    const previewSession: AdminSession = {
      email: cleanEmail,
      fullName: 'مدير منصة إعلاناتي (معاينة محلية)',
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
    throw new Error(error.message === 'Invalid login credentials' ? 'بيانات الدخول غير صحيحة' : error.message);
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
    throw new Error('هذا الحساب غير مسجل ضمن صلاحيات مديري منصة إعلاناتي في جدول elanati_admins');
  }

  return {
    email: adminRow.email,
    fullName: adminRow.full_name || 'مدير المنصة',
    isPreviewMode: false,
  };
}

export async function signUpFirstAdmin(email: string, password: string): Promise<{ needsEmailConfirmation: boolean; session: AdminSession | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured || !supabase) {
    const session = await signInAdmin(cleanEmail, password);
    return { needsEmailConfirmation: false, session };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  });
  if (error) throw new Error(error.message);

  if (!data.session) {
    return { needsEmailConfirmation: true, session: null };
  }

  const session = await getAdminSession();
  if (!session) {
    await supabase.auth.signOut();
    throw new Error('تم إنشاء الحساب ولكن البريد غير مضاف في جدول elanati_admins. أضف البريد في Supabase أولاً.');
  }
  return { needsEmailConfirmation: false, session };
}

export async function signOutAdmin(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(STORAGE_KEYS.previewAdmin);
}
