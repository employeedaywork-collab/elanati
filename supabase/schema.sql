-- ============================================================================
-- منصة إعلاناتي (Elanati) - Supabase PostgreSQL Schema + RLS + RPC + Seed Data
-- متوافق للتشغيل الجديد أو التحديث الآمن على الجداول الحالية
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) جدول مديري منصة إعلاناتي
CREATE TABLE IF NOT EXISTS public.elanati_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT 'مدير المنصة',
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_elanati_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.elanati_admins a
    WHERE a.user_id = auth.uid()
       OR ((auth.jwt() ->> 'email') IS NOT NULL
           AND lower(a.email) = lower(auth.jwt() ->> 'email'))
  );
$$;

-- 2) جدول الإعلانات (مع اسم المعلن ومدة الظهور التلقائية والصور الإضافية والبانر والأولوية)
CREATE TABLE IF NOT EXISTS public.elanati_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text,
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  contact text NOT NULL,
  whatsapp text,
  city text NOT NULL,
  image text NOT NULL DEFAULT '📦',
  image_url text,
  extra_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  banner_url text,
  package_name text NOT NULL DEFAULT 'مجاني',
  subscription_code text,
  priority_rank integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  admin_note text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- تحديث آمن إذا كان الجدول منشأً مسبقاً
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS extra_images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS subscription_code text;
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS priority_rank integer NOT NULL DEFAULT 0;
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.elanati_ads ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- إزالة قيد التصنيفات الثابت إن وجد سابقاً للسماح بإضافة تصنيفات جديدة ديناميكياً
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.elanati_ads'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%category%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.elanati_ads DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

-- ضبط تاريخ الانتهاء للإعلانات المجانية القديمة تلقائياً إن لم يكن مضبوطاً
UPDATE public.elanati_ads
SET starts_at = COALESCE(starts_at, created_at),
    expires_at = CASE
      WHEN package_name = 'مجاني' AND expires_at IS NULL THEN COALESCE(starts_at, created_at) + interval '7 days'
      WHEN package_name = 'الاحترافي' AND expires_at IS NULL THEN COALESCE(starts_at, created_at) + interval '30 days'
      ELSE expires_at
    END,
    priority_rank = CASE
      WHEN package_name = 'المؤسسي' THEN 2
      WHEN package_name = 'الاحترافي' OR featured = true THEN 1
      ELSE 0
    END;

CREATE INDEX IF NOT EXISTS idx_elanati_ads_status_created ON public.elanati_ads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elanati_ads_expires ON public.elanati_ads (expires_at);
CREATE INDEX IF NOT EXISTS idx_elanati_ads_contact ON public.elanati_ads (contact);
CREATE INDEX IF NOT EXISTS idx_elanati_ads_category ON public.elanati_ads (category);
CREATE INDEX IF NOT EXISTS idx_elanati_ads_city ON public.elanati_ads (city);

-- 3) جدول رسائل التواصل وتذاكر العملاء
CREATE TABLE IF NOT EXISTS public.elanati_contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL DEFAULT 'استفسار عام',
  message text NOT NULL,
  ad_id uuid REFERENCES public.elanati_ads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'replied', 'closed')),
  priority boolean NOT NULL DEFAULT false,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elanati_contact_messages ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_elanati_contact_status ON public.elanati_contact_messages (status, created_at DESC);

-- 4) جدول رسائل المحادثة المتبادلة بين العميل والمدير
CREATE TABLE IF NOT EXISTS public.elanati_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL REFERENCES public.elanati_contact_messages(ticket_code) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('client', 'admin')),
  sender_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elanati_support_ticket ON public.elanati_support_messages (ticket_code, created_at ASC);

-- 5) جدول طلبات الباقات والاشتراكات (مع الدفع بالجنيه المصري وتواريخ الاشتراك)
CREATE TABLE IF NOT EXISTS public.elanati_package_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code text UNIQUE,
  package_name text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  price_egp numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'vodafone_cash',
  payment_reference text,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  company_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'activated', 'cancelled')),
  max_ads integer NOT NULL DEFAULT 10,
  starts_at timestamptz,
  expires_at timestamptz,
  api_key text,
  account_manager_name text,
  account_manager_phone text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS subscription_code text;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'vodafone_cash';
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS max_ads integer NOT NULL DEFAULT 10;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS api_key text;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS account_manager_name text;
ALTER TABLE public.elanati_package_requests ADD COLUMN IF NOT EXISTS account_manager_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_elanati_pkg_req_sub_code ON public.elanati_package_requests (subscription_code) WHERE subscription_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elanati_pkg_req_phone ON public.elanati_package_requests (client_phone);

-- 6) جدول الباقات الديناميكية
CREATE TABLE IF NOT EXISTS public.elanati_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  popular boolean NOT NULL DEFAULT false,
  cta_label text NOT NULL DEFAULT 'ابدأ الآن',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- 7) جدول آراء العملاء
CREATE TABLE IF NOT EXISTS public.elanati_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  city text NOT NULL,
  text text NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  avatar text NOT NULL DEFAULT '👨‍💼',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8) جدول إعدادات الموقع والإحصائيات والمدفوعات ومدة الإعلانات
CREATE TABLE IF NOT EXISTS public.elanati_site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name text NOT NULL DEFAULT 'إعلاناتي',
  contact_email text NOT NULL DEFAULT 'employeedaywork@gmail.com',
  contact_phone text NOT NULL DEFAULT '01007008707',
  whatsapp_number text NOT NULL DEFAULT '201007008707',
  location_text text NOT NULL DEFAULT 'جمهورية مصر العربية',
  stat_advertisers integer NOT NULL DEFAULT 5000,
  stat_visits integer NOT NULL DEFAULT 12000,
  stat_traders integer NOT NULL DEFAULT 3500,
  stat_satisfaction integer NOT NULL DEFAULT 98,
  require_ad_approval boolean NOT NULL DEFAULT true,
  free_ad_days integer NOT NULL DEFAULT 7,
  pro_ad_days integer NOT NULL DEFAULT 30,
  vodafone_cash_number text NOT NULL DEFAULT '01007008707',
  instapay_handle text NOT NULL DEFAULT '01007008707',
  bank_account_info text NOT NULL DEFAULT 'تحويل بنكي أو إنستاباي على رقم 01007008707',
  payment_instructions text NOT NULL DEFAULT 'يرجى التحويل بالجنيه المصري ثم كتابة رقم المحفظة أو رقم مرجع العملية لتأكيد الاشتراك فوراً.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS free_ad_days integer NOT NULL DEFAULT 7;
ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS pro_ad_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS vodafone_cash_number text NOT NULL DEFAULT '01007008707';
ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS instapay_handle text NOT NULL DEFAULT '01007008707';
ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS bank_account_info text NOT NULL DEFAULT 'تحويل بنكي أو إنستاباي على رقم 01007008707';
ALTER TABLE public.elanati_site_settings ADD COLUMN IF NOT EXISTS payment_instructions text NOT NULL DEFAULT 'يرجى التحويل بالجنيه المصري ثم كتابة رقم المحفظة أو رقم مرجع العملية لتأكيد الاشتراك فوراً.';

-- ============================================================================
-- تفعيل Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.elanati_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_package_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own admin record" ON public.elanati_admins;
CREATE POLICY "Admins can view own admin record"
  ON public.elanati_admins FOR SELECT
  TO authenticated
  USING (public.is_elanati_admin());

-- الإعلانات العامة: تظهر فقط الإعلانات المعتمدة التي لم ينتهِ تاريخ صلاحيتها (expires_at)
DROP POLICY IF EXISTS "Public can read approved ads" ON public.elanati_ads;
CREATE POLICY "Public can read approved ads"
  ON public.elanati_ads FOR SELECT
  USING (
    (status = 'approved' AND (expires_at IS NULL OR expires_at > now()))
    OR public.is_elanati_admin()
  );

DROP POLICY IF EXISTS "Public can submit new ads" ON public.elanati_ads;
CREATE POLICY "Public can submit new ads"
  ON public.elanati_ads FOR INSERT
  WITH CHECK (
    public.is_elanati_admin()
    OR status IN ('pending', 'approved')
  );

DROP POLICY IF EXISTS "Admins can update ads" ON public.elanati_ads;
CREATE POLICY "Admins can update ads"
  ON public.elanati_ads FOR UPDATE
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Admins can delete ads" ON public.elanati_ads;
CREATE POLICY "Admins can delete ads"
  ON public.elanati_ads FOR DELETE
  TO authenticated
  USING (public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can create contact tickets" ON public.elanati_contact_messages;
CREATE POLICY "Public can create contact tickets"
  ON public.elanati_contact_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage contact tickets" ON public.elanati_contact_messages;
CREATE POLICY "Admins can manage contact tickets"
  ON public.elanati_contact_messages FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Clients can append messages to tickets" ON public.elanati_support_messages;
CREATE POLICY "Clients can append messages to tickets"
  ON public.elanati_support_messages FOR INSERT
  WITH CHECK (sender_role = 'client' OR public.is_elanati_admin());

DROP POLICY IF EXISTS "Admins can manage support messages" ON public.elanati_support_messages;
CREATE POLICY "Admins can manage support messages"
  ON public.elanati_support_messages FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can submit package requests" ON public.elanati_package_requests;
CREATE POLICY "Public can submit package requests"
  ON public.elanati_package_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage package requests" ON public.elanati_package_requests;
CREATE POLICY "Admins can manage package requests"
  ON public.elanati_package_requests FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can read active packages" ON public.elanati_packages;
CREATE POLICY "Public can read active packages"
  ON public.elanati_packages FOR SELECT
  USING (is_active = true OR public.is_elanati_admin());

DROP POLICY IF EXISTS "Admins can manage packages" ON public.elanati_packages;
CREATE POLICY "Admins can manage packages"
  ON public.elanati_packages FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can read visible testimonials" ON public.elanati_testimonials;
CREATE POLICY "Public can read visible testimonials"
  ON public.elanati_testimonials FOR SELECT
  USING (is_visible = true OR public.is_elanati_admin());

DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.elanati_testimonials;
CREATE POLICY "Admins can manage testimonials"
  ON public.elanati_testimonials FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can read site settings" ON public.elanati_site_settings;
CREATE POLICY "Public can read site settings"
  ON public.elanati_site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update site settings" ON public.elanati_site_settings;
CREATE POLICY "Admins can update site settings"
  ON public.elanati_site_settings FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

-- ============================================================================
-- دوال RPC للعملاء (مشاهدات + تذاكر + بوابة متابعة اشتراك العميل + فحص الحصة)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_elanati_ad_views(p_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.elanati_ads
  SET views_count = views_count + 1
  WHERE id = p_ad_id
    AND status = 'approved'
    AND (expires_at IS NULL OR expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.get_elanati_ticket_by_code(p_ticket_code text)
RETURNS TABLE (
  id uuid,
  ticket_code text,
  name text,
  subject text,
  message text,
  status text,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.ticket_code,
    m.name,
    m.subject,
    m.message,
    m.status,
    m.admin_reply,
    m.replied_at,
    m.created_at
  FROM public.elanati_contact_messages m
  WHERE upper(trim(m.ticket_code)) = upper(trim(p_ticket_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_elanati_ticket_messages(p_ticket_code text)
RETURNS TABLE (
  id uuid,
  ticket_code text,
  sender_role text,
  sender_name text,
  body text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.id,
    sm.ticket_code,
    sm.sender_role,
    sm.sender_name,
    sm.body,
    sm.created_at
  FROM public.elanati_support_messages sm
  WHERE upper(trim(sm.ticket_code)) = upper(trim(p_ticket_code))
  ORDER BY sm.created_at ASC;
$$;

-- بوابة العميل: الاستعلام برقم الهاتف أو كود الاشتراك لمعرفة تاريخ البداية والنهاية والعداد التنازلي وإعلاناته
CREATE OR REPLACE FUNCTION public.get_elanati_client_portal(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := trim(COALESCE(p_query, ''));
  v_digits text := regexp_replace(v_clean, '\D', '', 'g');
  v_sub record;
  v_phone text := NULL;
  v_ads jsonb;
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('subscription', NULL, 'ads', '[]'::jsonb);
  END IF;

  -- البحث أولاً بكود الاشتراك أو رقم الهاتف عن أحدث طلب اشتراك
  SELECT *
  INTO v_sub
  FROM public.elanati_package_requests r
  WHERE (r.subscription_code IS NOT NULL AND upper(trim(r.subscription_code)) = upper(v_clean))
     OR (v_digits <> '' AND regexp_replace(r.client_phone, '\D', '', 'g') = v_digits)
  ORDER BY
    CASE WHEN r.status = 'activated' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NOT NULL THEN
    v_phone := regexp_replace(v_sub.client_phone, '\D', '', 'g');
  ELSE
    v_phone := v_digits;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_ads
  FROM (
    SELECT
      id, client_name, title, category, description, contact, city, image, image_url,
      extra_images, banner_url, package_name, subscription_code, priority_rank,
      status, featured, views_count, starts_at, expires_at, created_at
    FROM public.elanati_ads
    WHERE (v_sub.subscription_code IS NOT NULL AND upper(COALESCE(subscription_code, '')) = upper(v_sub.subscription_code))
       OR (v_phone <> '' AND regexp_replace(contact, '\D', '', 'g') = v_phone)
  ) a;

  RETURN jsonb_build_object(
    'subscription',
    CASE WHEN v_sub.id IS NOT NULL THEN jsonb_build_object(
      'id', v_sub.id,
      'subscription_code', v_sub.subscription_code,
      'package_name', v_sub.package_name,
      'billing_cycle', v_sub.billing_cycle,
      'price_egp', v_sub.price_egp,
      'payment_method', v_sub.payment_method,
      'payment_reference', v_sub.payment_reference,
      'client_name', v_sub.client_name,
      'client_phone', v_sub.client_phone,
      'company_name', v_sub.company_name,
      'status', v_sub.status,
      'max_ads', v_sub.max_ads,
      'starts_at', v_sub.starts_at,
      'expires_at', v_sub.expires_at,
      'api_key', v_sub.api_key,
      'account_manager_name', v_sub.account_manager_name,
      'account_manager_phone', v_sub.account_manager_phone,
      'created_at', v_sub.created_at
    ) ELSE NULL END,
    'ads', v_ads
  );
END;
$$;

-- فحص حصة الإعلانات المسموحة للعميل قبل نشر إعلان جديد
CREATE OR REPLACE FUNCTION public.check_elanati_ad_allowance(
  p_contact text,
  p_subscription_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_contact, ''), '\D', '', 'g');
  v_code text := upper(trim(COALESCE(p_subscription_code, '')));
  v_sub record;
  v_active_ads integer := 0;
  v_free_days integer := 7;
  v_pro_days integer := 30;
BEGIN
  SELECT free_ad_days, pro_ad_days
  INTO v_free_days, v_pro_days
  FROM public.elanati_site_settings
  WHERE id = 1;

  v_free_days := COALESCE(v_free_days, 7);
  v_pro_days := COALESCE(v_pro_days, 30);

  SELECT *
  INTO v_sub
  FROM public.elanati_package_requests r
  WHERE r.status = 'activated'
    AND (r.expires_at IS NULL OR r.expires_at > now())
    AND (
      (v_code <> '' AND upper(COALESCE(r.subscription_code, '')) = v_code)
      OR (v_digits <> '' AND regexp_replace(r.client_phone, '\D', '', 'g') = v_digits)
    )
  ORDER BY r.created_at DESC
  LIMIT 1;

  SELECT COUNT(*)
  INTO v_active_ads
  FROM public.elanati_ads a
  WHERE a.status IN ('approved', 'pending')
    AND (a.expires_at IS NULL OR a.expires_at > now())
    AND (
      (v_sub.subscription_code IS NOT NULL AND upper(COALESCE(a.subscription_code, '')) = upper(v_sub.subscription_code))
      OR (v_digits <> '' AND regexp_replace(a.contact, '\D', '', 'g') = v_digits)
    );

  IF v_sub.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', v_active_ads < v_sub.max_ads,
      'package_name', v_sub.package_name,
      'subscription_code', v_sub.subscription_code,
      'subscription_expires_at', v_sub.expires_at,
      'max_ads', v_sub.max_ads,
      'used_ads', v_active_ads,
      'duration_days', CASE WHEN v_sub.package_name = 'المؤسسي' THEN NULL ELSE v_pro_days END,
      'is_permanent', v_sub.package_name = 'المؤسسي',
      'featured', true,
      'priority_rank', CASE WHEN v_sub.package_name = 'المؤسسي' THEN 2 ELSE 1 END,
      'allow_extra_images', true,
      'allow_banner', v_sub.package_name = 'المؤسسي'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_active_ads < 1,
    'package_name', 'مجاني',
    'subscription_code', NULL,
    'max_ads', 1,
    'used_ads', v_active_ads,
    'duration_days', v_free_days,
    'is_permanent', false,
    'featured', false,
    'priority_rank', 0,
    'allow_extra_images', false,
    'allow_banner', false
  );
END;
$$;

-- ============================================================================
-- البيانات الأولية (Seed Data)
-- ============================================================================
INSERT INTO public.elanati_admins (email, full_name, role)
VALUES ('employeedaywork@gmail.com', 'مدير منصة إعلاناتي', 'super_admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.elanati_site_settings (
  id, site_name, contact_email, contact_phone, whatsapp_number,
  location_text, stat_advertisers, stat_visits, stat_traders, stat_satisfaction,
  require_ad_approval, free_ad_days, pro_ad_days, vodafone_cash_number, instapay_handle,
  bank_account_info, payment_instructions
)
VALUES (
  1, 'إعلاناتي', 'employeedaywork@gmail.com', '01007008707', '201007008707',
  'جمهورية مصر العربية', 5000, 12000, 3500, 98,
  true, 7, 30, '01007008707', '01007008707',
  'تحويل بنكي أو إنستاباي على رقم 01007008707',
  'يرجى التحويل بالجنيه المصري ثم كتابة رقم المحفظة أو رقم مرجع العملية لتأكيد الاشتراك فوراً.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.elanati_packages (slug, name, monthly_price, annual_price, description, features, popular, cta_label, sort_order)
VALUES
  ('free', 'مجاني', 0, 0, 'مثالي للبدء والتجربة',
   '["إعلان واحد فقط","ظهور لمدة 7 أيام","تصنيف أساسي","دعم عبر البريد"]'::jsonb,
   false, 'ابدأ مجاناً', 1),
  ('pro', 'الاحترافي', 249, 199, 'الأكثر شعبية بين التجار',
   '["حتى 10 إعلانات","ظهور لمدة 30 يوم","إعلان مميز (نجمي)","تقارير أداء مفصلة","دعم أولوية","صور إضافية"]'::jsonb,
   true, 'اشترك الآن', 2),
  ('enterprise', 'المؤسسي', 599, 499, 'للموزعين والشركات الكبيرة',
   '["إعلانات غير محدودة","ظهور دائم","إعلان مميز + بانر","تقارير متقدمة + API","مدير حساب خاص","أولوية في الظهور","حملات إعلانية مخصصة"]'::jsonb,
   false, 'تواصل معنا', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.elanati_ads (
  client_name, title, category, description, contact, whatsapp, city, image, package_name,
  status, featured, priority_rank, views_count, starts_at, expires_at
)
SELECT
  v.client_name, v.title, v.category, v.description, v.contact, v.whatsapp, v.city, v.image, v.package_name,
  v.status, v.featured, v.priority_rank, v.views_count, now(), v.expires_at
FROM (
  VALUES
    ('شركة النيل للتوريدات', 'توزيع مواد غذائية بالجملة', 'توزيع', 'نوفر جميع المواد الغذائية بالجملة بأسعار تنافسية مع خدمة توصيل لجميع المحافظات', '01007008707', '201007008707', 'القاهرة', '📦', 'المؤسسي', 'approved', true, 2, 148, NULL::timestamptz),
    ('أحمد سامي', 'عروض خاصة على الأجهزة الإلكترونية', 'تجارة', 'خصومات تصل إلى 40% على جميع الأجهزة الإلكترونية - عرض محدود للتجار والموزعين', '01012345678', '201012345678', 'الإسكندرية', '💻', 'الاحترافي', 'approved', true, 1, 112, now() + interval '30 days'),
    ('محمود حسن', 'محل ملابس رجالي - تشكيلة جديدة', 'محلات', 'وصلتنا تشكيلة جديدة من الملابس الرجالية العصرية بأسعار مناسبة للتجار والأفراد', '01098765432', '201098765432', 'الدقهلية', '👔', 'مجاني', 'approved', false, 0, 64, now() + interval '7 days'),
    ('شركة الفجر لمستحضرات التجميل', 'وكالة توزيع مستحضرات تجميل', 'توزيع', 'وكالة حصرية لتوزيع مستحضرات التجميل العالمية - أسعار خاصة للتجار وأصحاب الصيدليات', '01155566778', '201155566778', 'الجيزة', '💄', 'مجاني', 'approved', false, 0, 89, now() + interval '7 days'),
    ('خالد عبد الرحمن', 'معرض أثاث ومفروشات', 'محلات', 'أحدث تصاميم الأثاث والمفروشات المنزلية والمكتبية بأسعار الجملة وتسهيلات في السداد', '01234567890', '201234567890', 'الغربية', '🪑', 'الاحترافي', 'approved', true, 1, 131, now() + interval '30 days'),
    ('طارق إبراهيم', 'توزيع مواد بناء', 'توزيع', 'جميع مواد البناء والتشييد بأسعار الجملة مع التوصيل المباشر للمواقع والمشاريع', '01556789012', '201556789012', 'المنيا', '🏗️', 'مجاني', 'approved', false, 0, 73, now() + interval '7 days')
) AS v(client_name, title, category, description, contact, whatsapp, city, image, package_name, status, featured, priority_rank, views_count, expires_at)
WHERE NOT EXISTS (SELECT 1 FROM public.elanati_ads);

INSERT INTO public.elanati_testimonials (name, role, city, text, rating, avatar, is_visible)
SELECT v.name, v.role, v.city, v.text, v.rating, v.avatar, v.is_visible
FROM (
  VALUES
    ('أحمد محمود', 'موزع مواد غذائية', 'القاهرة', 'منصة ممتازة! حصلت على عقود توزيع جديدة خلال أسبوع واحد من نشر إعلاني. أنصح بها كل موزع.', 5, '👨‍💼', true),
    ('سارة أحمد', 'صاحبة محل ملابس', 'الإسكندرية', 'المنصة سهلت علي الوصول لعملاء جدد بشكل كبير. الإعلانات سهلة النشر والنتائج مذهلة.', 5, '👩‍💼', true),
    ('محمد علي', 'مدير مبيعات', 'الدقهلية', 'أفضل منصة إعلانية مخصصة للتجار والموزعين في مصر. الدعم الفني ممتاز والأسعار معقولة جداً.', 5, '👨‍💻', true)
) AS v(name, role, city, text, rating, avatar, is_visible)
WHERE NOT EXISTS (SELECT 1 FROM public.elanati_testimonials);

-- ============================================================================
-- 9) جداول ودوال الأتمتة الكاملة (إزالة الإعلانات المنتهية + ربط الواتساب التلقائي)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.elanati_automation_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_archive_expired boolean NOT NULL DEFAULT true,
  auto_whatsapp_enabled boolean NOT NULL DEFAULT false,
  free_reminder_hours_before integer NOT NULL DEFAULT 48,
  paid_reminder_days_before integer NOT NULL DEFAULT 7,
  whatsapp_provider text NOT NULL DEFAULT 'ultramsg' CHECK (whatsapp_provider IN ('ultramsg', 'meta_cloud', 'webhook')),
  whatsapp_endpoint text NOT NULL DEFAULT '',
  whatsapp_token text NOT NULL DEFAULT '',
  free_expiry_template text NOT NULL DEFAULT '',
  paid_expiry_template text NOT NULL DEFAULT '',
  last_run_at timestamptz,
  last_run_summary text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.elanati_whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('free_ad_expiry', 'paid_sub_expiry', 'auto_reply')),
  target_id text NOT NULL,
  target_expires_at timestamptz,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  message_body text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed')),
  provider_response text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elanati_whatsapp_logs_target
  ON public.elanati_whatsapp_logs (target_type, target_id, sent_at DESC);

ALTER TABLE public.elanati_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elanati_whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage automation config" ON public.elanati_automation_config;
CREATE POLICY "Admins can manage automation config"
  ON public.elanati_automation_config FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

DROP POLICY IF EXISTS "Admins can manage whatsapp logs" ON public.elanati_whatsapp_logs;
CREATE POLICY "Admins can manage whatsapp logs"
  ON public.elanati_whatsapp_logs FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

INSERT INTO public.elanati_automation_config (
  id,
  auto_archive_expired,
  auto_whatsapp_enabled,
  free_reminder_hours_before,
  paid_reminder_days_before,
  whatsapp_provider,
  whatsapp_endpoint,
  whatsapp_token,
  free_expiry_template,
  paid_expiry_template
)
VALUES (
  1,
  true,
  false,
  48,
  7,
  'ultramsg',
  '',
  '',
  E'أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nإعلان حضرتك "{عنوان_الإعلان}" شافوه {المشاهدات} تاجر ومهتم حتى الآن، وهينتهي ظهوره المجاني خلال 48 ساعة.\nلو حابب يفضل إعلانك ظاهر 30 يوم كاملة في أعلى النتائج + نجمة تمييز + إمكانية إضافة 10 إعلانات وصور متعددة للمنتجات:\nتقدر تفعّل الباقة الاحترافية بـ 249 جنيه فقط عبر فودافون كاش أو إنستاباي على رقم 01007008707 وهيتفعل فوراً مع عدّاد لمتابعة اشتراكك.\nتحب أفعل لحضرتك الترقية؟',
  E'أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nنود تذكير حضرتك بأن اشتراكك في باقة "{الباقة}" (كود {كود_الاشتراك}) سينتهي خلال {الأيام_المتبقية} أيام بتاريخ {تاريخ_الانتهاء}.\nحتى تستمر إعلاناتك ظاهرة أمام التجار بدون انقطاع، يمكنك تجديد الاشتراك عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nتحب نجهز لحضرتك التجديد الآن؟'
)
ON CONFLICT (id) DO NOTHING;

-- دالة أرشفة وإزالة الإعلانات المنتهية تلقائياً حسب تاريخ الاشتراك أو الصلاحية المسجل
CREATE OR REPLACE FUNCTION public.archive_expired_elanati_ads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_elanati_admin() THEN
    RAISE EXCEPTION 'غير مصرح بتنفيذ هذا الإجراء';
  END IF;

  UPDATE public.elanati_ads a
  SET status = 'archived',
      updated_at = now()
  WHERE a.status = 'approved'
    AND (
      (a.expires_at IS NOT NULL AND a.expires_at <= now())
      OR EXISTS (
        SELECT 1
        FROM public.elanati_package_requests r
        WHERE a.subscription_code IS NOT NULL
          AND upper(a.subscription_code) = upper(r.subscription_code)
          AND a.package_name <> 'المؤسسي'
          AND (
            r.status = 'cancelled'
            OR (r.expires_at IS NOT NULL AND r.expires_at <= now())
          )
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- جدولة تلقائية داخل PostgreSQL إن كان ملحق pg_cron مفعّلاً في المشروع
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('elanati-archive-expired-ads');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'elanati-archive-expired-ads',
      '0 * * * *',
      'SELECT public.archive_expired_elanati_ads();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- قراءة قوالب ومواعيد التنبيه فقط للعرض التلقائي داخل المنصة (بدون أي مفاتيح سرية)
CREATE OR REPLACE FUNCTION public.get_elanati_public_templates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'free_reminder_hours_before', COALESCE(free_reminder_hours_before, 48),
    'paid_reminder_days_before', COALESCE(paid_reminder_days_before, 7),
    'free_expiry_template', free_expiry_template,
    'paid_expiry_template', paid_expiry_template
  )
  FROM public.elanati_automation_config
  WHERE id = 1
  LIMIT 1;
$$;

-- الرد التلقائي الذكي داخل نظام التذاكر والمحادثة في المنصة (مجاني بالكامل)
CREATE OR REPLACE FUNCTION public.send_elanati_internal_auto_reply(
  p_ticket_code text,
  p_client_name text,
  p_client_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code text := upper(trim(COALESCE(p_ticket_code, '')));
  v_digits text := regexp_replace(COALESCE(p_client_phone, ''), '\D', '', 'g');
  v_ad record;
  v_sub record;
  v_template text;
  v_reply text;
  v_name text;
  v_rem_days integer;
BEGIN
  IF v_clean_code = '' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.elanati_contact_messages m WHERE upper(m.ticket_code) = v_clean_code
  ) THEN
    RETURN;
  END IF;

  -- تجنب تكرار الرد الآلي على نفس التذكرة
  IF EXISTS (
    SELECT 1 FROM public.elanati_support_messages sm
    WHERE upper(sm.ticket_code) = v_clean_code AND sm.sender_role = 'admin'
  ) THEN
    RETURN;
  END IF;

  IF v_digits <> '' THEN
    SELECT *
    INTO v_sub
    FROM public.elanati_package_requests r
    WHERE regexp_replace(r.client_phone, '\D', '', 'g') = v_digits
    ORDER BY CASE WHEN r.status = 'activated' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 1;

    SELECT *
    INTO v_ad
    FROM public.elanati_ads a
    WHERE regexp_replace(a.contact, '\D', '', 'g') = v_digits
    ORDER BY a.created_at DESC
    LIMIT 1;
  END IF;

  v_name := COALESCE(
    NULLIF(trim(COALESCE(v_ad.client_name, '')), ''),
    NULLIF(trim(COALESCE(v_sub.client_name, '')), ''),
    NULLIF(trim(COALESCE(p_client_name, '')), ''),
    'عميلنا العزيز'
  );

  IF v_sub.id IS NOT NULL AND v_sub.status = 'activated' AND v_sub.expires_at IS NOT NULL THEN
    v_rem_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_sub.expires_at - now())) / 86400)::integer);
    SELECT paid_expiry_template INTO v_template FROM public.elanati_automation_config WHERE id = 1;
    v_reply := COALESCE(
      v_template,
      E'أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nنود تذكير حضرتك بأن اشتراكك في باقة "{الباقة}" (كود {كود_الاشتراك}) سينتهي خلال {الأيام_المتبقية} أيام بتاريخ {تاريخ_الانتهاء}.\nحتى تستمر إعلاناتك ظاهرة أمام التجار بدون انقطاع، يمكنك تجديد الاشتراك عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nتحب نجهز لحضرتك التجديد الآن؟'
    );
    v_reply := replace(v_reply, '{الاسم}', v_name);
    v_reply := replace(v_reply, '{الباقة}', v_sub.package_name);
    v_reply := replace(v_reply, '{كود_الاشتراك}', COALESCE(v_sub.subscription_code, '-'));
    v_reply := replace(v_reply, '{الأيام_المتبقية}', v_rem_days::text);
    v_reply := replace(v_reply, '{تاريخ_الانتهاء}', to_char(v_sub.expires_at, 'YYYY-MM-DD'));
  ELSIF v_ad.id IS NOT NULL THEN
    SELECT free_expiry_template INTO v_template FROM public.elanati_automation_config WHERE id = 1;
    v_reply := COALESCE(
      v_template,
      E'أهلاً أستاذ {الاسم}، مع حضرتك إدارة منصة إعلاناتي 👋\nإعلان حضرتك "{عنوان_الإعلان}" شافوه {المشاهدات} تاجر ومهتم حتى الآن، وهينتهي ظهوره المجاني خلال 48 ساعة.\nلو حابب يفضل إعلانك ظاهر 30 يوم كاملة في أعلى النتائج + نجمة تمييز + إمكانية إضافة 10 إعلانات وصور متعددة للمنتجات:\nتقدر تفعّل الباقة الاحترافية بـ 249 جنيه فقط عبر فودافون كاش أو إنستاباي على رقم 01007008707 وهيتفعل فوراً مع عدّاد لمتابعة اشتراكك.\nتحب أفعل لحضرتك الترقية؟'
    );
    v_reply := replace(v_reply, '{الاسم}', v_name);
    v_reply := replace(v_reply, '{عنوان_الإعلان}', v_ad.title);
    v_reply := replace(v_reply, '{المشاهدات}', COALESCE(v_ad.views_count, 0)::text);
    v_reply := replace(v_reply, '{تاريخ_الانتهاء}', COALESCE(to_char(v_ad.expires_at, 'YYYY-MM-DD'), 'دائم'));
  ELSE
    v_reply := format(
      E'أهلاً أستاذ %s، مع حضرتك إدارة منصة إعلاناتي 👋\nتم استلام رسالتك برقم المتابعة %s.\nيمكنك نشر إعلانك الأول مجاناً لمدة 7 أيام، أو الاشتراك في الباقة الاحترافية بـ 249 جنيه فقط (حتى 10 إعلانات + ظهور 30 يوم + تمييز نجمي) عبر فودافون كاش أو إنستاباي على رقم 01007008707.\nسيتابع معك فريق الإدارة فوراً على نفس التذكرة.',
      v_name,
      v_clean_code
    );
  END IF;

  INSERT INTO public.elanati_support_messages (ticket_code, sender_role, sender_name, body)
  VALUES (v_clean_code, 'admin', 'الرد الآلي — إدارة إعلاناتي', v_reply);
END;
$$;

-- ============================================================================
-- 10) جدول التصنيفات الديناميكية (إضافة وحفظ التصنيفات الجديدة)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.elanati_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elanati_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active categories" ON public.elanati_categories;
CREATE POLICY "Public can read active categories"
  ON public.elanati_categories FOR SELECT
  USING (is_active = true OR public.is_elanati_admin());

DROP POLICY IF EXISTS "Public can insert custom categories" ON public.elanati_categories;
CREATE POLICY "Public can insert custom categories"
  ON public.elanati_categories FOR INSERT
  WITH CHECK (length(trim(name)) BETWEEN 2 AND 60);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.elanati_categories;
CREATE POLICY "Admins can manage categories"
  ON public.elanati_categories FOR ALL
  TO authenticated
  USING (public.is_elanati_admin())
  WITH CHECK (public.is_elanati_admin());

INSERT INTO public.elanati_categories (name, sort_order, is_active)
VALUES
  ('توزيع', 1, true),
  ('تجارة', 2, true),
  ('محلات', 3, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- صلاحيات الوصول والتحديث اللحظي
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.elanati_site_settings, public.elanati_packages, public.elanati_testimonials, public.elanati_ads, public.elanati_categories TO anon, authenticated;
GRANT INSERT ON public.elanati_ads, public.elanati_contact_messages, public.elanati_support_messages, public.elanati_package_requests, public.elanati_categories TO anon, authenticated;
GRANT ALL ON public.elanati_admins, public.elanati_ads, public.elanati_contact_messages, public.elanati_support_messages, public.elanati_package_requests, public.elanati_packages, public.elanati_testimonials, public.elanati_site_settings, public.elanati_automation_config, public.elanati_whatsapp_logs, public.elanati_categories TO authenticated;

GRANT EXECUTE ON FUNCTION public.increment_elanati_ad_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_elanati_ticket_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_elanati_ticket_messages(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_elanati_client_portal(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_elanati_ad_allowance(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_elanati_public_templates() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_elanati_internal_auto_reply(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_expired_elanati_ads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_elanati_admin() TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_ads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_contact_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_support_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_package_requests;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_whatsapp_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elanati_categories;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
