-- ============================================================================
-- منصة إعلاناتي (Elanati) - Supabase PostgreSQL Schema + RLS + RPC + Seed Data
-- آمن للتشغيل في نفس مشروع Supabase دون تعارض مع جداول Work-System الحالية
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

-- دالة مساعدة للتحقق من صلاحية المدير في سياسات RLS
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
       OR (auth.jwt() ->> 'email') IS NOT NULL
          AND lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 2) جدول الإعلانات
CREATE TABLE IF NOT EXISTS public.elanati_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('توزيع', 'تجارة', 'محلات')),
  description text NOT NULL,
  contact text NOT NULL,
  whatsapp text,
  city text NOT NULL,
  image text NOT NULL DEFAULT '📦',
  image_url text,
  package_name text NOT NULL DEFAULT 'مجاني',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elanati_ads_status_created ON public.elanati_ads (status, created_at DESC);
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
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elanati_contact_status ON public.elanati_contact_messages (status, created_at DESC);

-- 4) جدول رسائل المحادثة المتبادلة بين العميل والمدير لكل تذكرة
CREATE TABLE IF NOT EXISTS public.elanati_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL REFERENCES public.elanati_contact_messages(ticket_code) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('client', 'admin')),
  sender_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elanati_support_ticket ON public.elanati_support_messages (ticket_code, created_at ASC);

-- 5) جدول طلبات الباقات والاشتراكات
CREATE TABLE IF NOT EXISTS public.elanati_package_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  price_egp numeric NOT NULL DEFAULT 0,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  company_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'activated', 'cancelled')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

-- 8) جدول إعدادات الموقع والإحصائيات
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
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- سياسات elanati_admins
DROP POLICY IF EXISTS "Admins can view own admin record" ON public.elanati_admins;
CREATE POLICY "Admins can view own admin record"
  ON public.elanati_admins FOR SELECT
  TO authenticated
  USING (public.is_elanati_admin());

-- سياسات elanati_ads
DROP POLICY IF EXISTS "Public can read approved ads" ON public.elanati_ads;
CREATE POLICY "Public can read approved ads"
  ON public.elanati_ads FOR SELECT
  USING (status = 'approved' OR public.is_elanati_admin());

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

-- سياسات elanati_contact_messages
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

-- سياسات elanati_support_messages
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

-- سياسات elanati_package_requests
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

-- سياسات elanati_packages
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

-- سياسات elanati_testimonials
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

-- سياسات elanati_site_settings
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
-- دوال RPC آمنة للعملاء (متابعة التذكرة + عداد المشاهدات)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_elanati_ad_views(p_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.elanati_ads
  SET views_count = views_count + 1
  WHERE id = p_ad_id AND status = 'approved';
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

-- ============================================================================
-- البيانات الأولية (Seed Data)
-- ============================================================================

-- تسجيل البريد الإلكتروني الرسمي للمالك كمدير افتراضي
INSERT INTO public.elanati_admins (email, full_name, role)
VALUES ('employeedaywork@gmail.com', 'مدير منصة إعلاناتي', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- إعدادات الموقع الافتراضية
INSERT INTO public.elanati_site_settings (
  id, site_name, contact_email, contact_phone, whatsapp_number,
  location_text, stat_advertisers, stat_visits, stat_traders, stat_satisfaction, require_ad_approval
)
VALUES (
  1, 'إعلاناتي', 'employeedaywork@gmail.com', '01007008707', '201007008707',
  'جمهورية مصر العربية', 5000, 12000, 3500, 98, true
)
ON CONFLICT (id) DO NOTHING;

-- الباقات الافتراضية
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

-- الإعلانات الافتراضية (تُضاف فقط إذا كان الجدول فارغاً)
INSERT INTO public.elanati_ads (title, category, description, contact, whatsapp, city, image, status, featured, views_count)
SELECT v.title, v.category, v.description, v.contact, v.whatsapp, v.city, v.image, v.status, v.featured, v.views_count
FROM (
  VALUES
    ('توزيع مواد غذائية بالجملة', 'توزيع', 'نوفر جميع المواد الغذائية بالجملة بأسعار تنافسية مع خدمة توصيل لجميع المحافظات', '01007008707', '201007008707', 'القاهرة', '📦', 'approved', true, 148),
    ('عروض خاصة على الأجهزة الإلكترونية', 'تجارة', 'خصومات تصل إلى 40% على جميع الأجهزة الإلكترونية - عرض محدود للتجار والموزعين', '01012345678', '201012345678', 'الإسكندرية', '💻', 'approved', true, 112),
    ('محل ملابس رجالي - تشكيلة جديدة', 'محلات', 'وصلتنا تشكيلة جديدة من الملابس الرجالية العصرية بأسعار مناسبة للتجار والأفراد', '01098765432', '201098765432', 'الدقهلية', '👔', 'approved', false, 64),
    ('وكالة توزيع مستحضرات تجميل', 'توزيع', 'وكالة حصرية لتوزيع مستحضرات التجميل العالمية - أسعار خاصة للتجار وأصحاب الصيدليات', '01155566778', '201155566778', 'الجيزة', '💄', 'approved', false, 89),
    ('معرض أثاث ومفروشات', 'محلات', 'أحدث تصاميم الأثاث والمفروشات المنزلية والمكتبية بأسعار الجملة وتسهيلات في السداد', '01234567890', '201234567890', 'الغربية', '🪑', 'approved', true, 131),
    ('توزيع مواد بناء', 'توزيع', 'جميع مواد البناء والتشييد بأسعار الجملة مع التوصيل المباشر للمواقع والمشاريع', '01556789012', '201556789012', 'المنيا', '🏗️', 'approved', false, 73)
) AS v(title, category, description, contact, whatsapp, city, image, status, featured, views_count)
WHERE NOT EXISTS (SELECT 1 FROM public.elanati_ads);

-- آراء العملاء الافتراضية
INSERT INTO public.elanati_testimonials (name, role, city, text, rating, avatar, is_visible)
SELECT v.name, v.role, v.city, v.text, v.rating, v.avatar, v.is_visible
FROM (
  VALUES
    ('أحمد محمود', 'موزع مواد غذائية', 'القاهرة', 'منصة ممتازة! حصلت على عقود توزيع جديدة خلال أسبوع واحد من نشر إعلاني. أنصح بها كل موزع.', 5, '👨‍💼', true),
    ('سارة أحمد', 'صاحبة محل ملابس', 'الإسكندرية', 'المنصة سهلت علي الوصول لعملاء جدد بشكل كبير. الإعلانات سهلة النشر والنتائج مذهلة.', 5, '👩‍💼', true),
    ('محمد علي', 'مدير مبيعات', 'الدقهلية', 'أفضل منصة إعلانية مخصصة للتجار والموزعين في مصر. الدعم الفني ممتاز والأسعار معقولة جداً.', 5, '👨‍💻', true)
) AS v(name, role, city, text, rating, avatar, is_visible)
WHERE NOT EXISTS (SELECT 1 FROM public.elanati_testimonials);
