export type AdCategory = 'توزيع' | 'تجارة' | 'محلات';
export type AdStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export interface Ad {
  id: string;
  title: string;
  category: AdCategory;
  description: string;
  contact: string;
  whatsapp?: string | null;
  city: string;
  image: string;
  image_url?: string | null;
  package_name?: string;
  status: AdStatus;
  featured: boolean;
  views_count: number;
  admin_note?: string | null;
  created_at: string;
  updated_at?: string;
}

export type TicketStatus = 'new' | 'in_progress' | 'replied' | 'closed';

export interface ContactMessage {
  id: string;
  ticket_code: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  ad_id?: string | null;
  status: TicketStatus;
  admin_reply?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_code: string;
  sender_role: 'client' | 'admin';
  sender_name: string;
  body: string;
  created_at: string;
}

export type PackageRequestStatus = 'pending' | 'contacted' | 'activated' | 'cancelled';

export interface PackageRequest {
  id: string;
  package_name: string;
  billing_cycle: 'monthly' | 'annual';
  price_egp: number;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  company_name?: string | null;
  notes?: string | null;
  status: PackageRequestStatus;
  admin_note?: string | null;
  created_at: string;
}

export interface PackagePlan {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  description: string;
  features: string[];
  popular: boolean;
  cta_label: string;
  sort_order: number;
  is_active: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  city: string;
  text: string;
  rating: number;
  avatar: string;
  is_visible: boolean;
  created_at?: string;
}

export interface SiteSettings {
  id: number;
  site_name: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  location_text: string;
  stat_advertisers: number;
  stat_visits: number;
  stat_traders: number;
  stat_satisfaction: number;
  require_ad_approval: boolean;
  updated_at?: string;
}

export interface AdminSession {
  email: string;
  fullName: string;
  isPreviewMode: boolean;
}
