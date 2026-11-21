export type AdCategory = string;
export type AdStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type PaymentMethod = 'vodafone_cash' | 'instapay' | 'bank_transfer';

export interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Ad {
  id: string;
  client_name?: string | null;
  title: string;
  category: AdCategory;
  description: string;
  contact: string;
  whatsapp?: string | null;
  city: string;
  image: string;
  image_url?: string | null;
  extra_images?: string[];
  banner_url?: string | null;
  package_name?: string;
  subscription_code?: string | null;
  owner_pin?: string | null;
  priority_rank?: number;
  status: AdStatus;
  featured: boolean;
  views_count: number;
  client_edits_count?: number;
  last_client_edited_at?: string | null;
  admin_note?: string | null;
  starts_at?: string;
  expires_at?: string | null;
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
  priority?: boolean;
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
  subscription_code?: string | null;
  package_name: string;
  billing_cycle: 'monthly' | 'annual';
  price_egp: number;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  company_name?: string | null;
  notes?: string | null;
  status: PackageRequestStatus;
  max_ads?: number;
  starts_at?: string | null;
  expires_at?: string | null;
  api_key?: string | null;
  account_manager_name?: string | null;
  account_manager_phone?: string | null;
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
  free_ad_days: number;
  pro_ad_days: number;
  vodafone_cash_number: string;
  instapay_handle: string;
  bank_account_info: string;
  payment_instructions: string;
  updated_at?: string;
}

export interface AdminSession {
  email: string;
  fullName: string;
  isPreviewMode: boolean;
}

export interface AdAllowance {
  allowed: boolean;
  package_name: string;
  subscription_code?: string | null;
  subscription_expires_at?: string | null;
  max_ads: number;
  used_ads: number;
  duration_days: number | null;
  is_permanent: boolean;
  featured: boolean;
  priority_rank: number;
  allow_extra_images: boolean;
  allow_banner: boolean;
  free_trial_used?: boolean;
  free_block_reason?: 'phone' | 'name' | 'both' | null;
}

export interface ClientPortalData {
  subscription: PackageRequest | null;
  payments: PackageRequest[];
  ads: Ad[];
}

export type WhatsAppProvider = 'ultramsg' | 'meta_cloud' | 'webhook';

export interface AutomationConfig {
  id: number;
  auto_archive_expired: boolean;
  auto_whatsapp_enabled: boolean;
  free_reminder_hours_before: number;
  paid_reminder_days_before: number;
  whatsapp_provider: WhatsAppProvider;
  whatsapp_endpoint: string;
  whatsapp_token: string;
  free_expiry_template: string;
  paid_expiry_template: string;
  last_run_at?: string | null;
  last_run_summary?: string | null;
  updated_at?: string;
}

export interface WhatsAppLog {
  id: string;
  target_type: 'free_ad_expiry' | 'paid_sub_expiry' | 'auto_reply';
  target_id: string;
  target_expires_at?: string | null;
  client_name: string;
  client_phone: string;
  message_body: string;
  delivery_status: 'sent' | 'failed';
  provider_response?: string | null;
  sent_at: string;
}

export interface AutomationTargetPreview {
  target_type: 'free_ad_expiry' | 'paid_sub_expiry';
  target_id: string;
  target_expires_at: string;
  client_name: string;
  client_phone: string;
  title: string;
  views_count?: number;
  remaining_label: string;
  message_body: string;
  already_sent: boolean;
  whatsapp_direct_url: string;
}

export interface AutomationRunResult {
  ok: boolean;
  archivedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  summary: string;
}
