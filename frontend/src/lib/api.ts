const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type IndustryType = "healthcare" | "salon" | "legal" | "auto" | "custom";

export interface Conversation {
  id: string;
  wa_user_id: string;
  current_state: string;
  is_ai_active: boolean;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
  last_message_sender?: string | null;
  last_message_time?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: "user" | "assistant" | "operator" | "system";
  content: string;
  meta_message_id?: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  business_id?: string;
  conversation_id?: string | null;
  client_name?: string | null;
  patient_name?: string | null; // legacy backwards-compatibility alias
  phone?: string | null;
  slot_time: string;
  service?: string | null;
  service_type?: string | null;
  provider_name?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
}

export interface DayHours {
  is_closed: boolean;
  open: string;
  close: string;
}

export interface OperatingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface BroadcastNotice {
  is_active: boolean;
  notice_text: string;
  effective_dates: string;
}

export type EmergencyNotice = BroadcastNotice;

export interface ServiceItem {
  id?: string;
  name: string;
  price: number;
  duration: string;
  category: string;
}

export interface FaqItem {
  id?: string;
  question: string;
  answer: string;
}

export interface BusinessConfig {
  business_id?: string;
  business_name: string;
  industry?: IndustryType;
  client_label?: string;
  provider_label?: string;
  tone?: string;
  currency?: string;
  currency_symbol?: string;
  broadcast_notice?: BroadcastNotice;
  emergency_notice?: BroadcastNotice; // legacy alias
  operating_hours?: OperatingHours;
  services?: ServiceItem[];
  faqs?: FaqItem[];
  escalation_rules?: string[];
  updated_at?: string;
}

export interface AnalyticsData {
  total_leads: number;
  booked_count: number;
  conversion_rate: number;
  active_ai_count: number;
  escalated_count: number;
  top_services: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  business_name: string;
  industry?: IndustryType;
  client_label?: string;
  provider_label?: string;
  currency?: string;
  broadcast_notice_active?: boolean;
  emergency_notice_active?: boolean;
  broadcast_notice?: BroadcastNotice;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_URL}/api/conversations`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.statusText}`);
  return res.json();
}

export async function fetchConversationMessages(convId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/api/conversations/${convId}/messages`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);
  return res.json();
}

export async function toggleAiMode(convId: string, isAiActive: boolean): Promise<{ is_ai_active: boolean }> {
  const res = await fetch(`${API_URL}/api/conversations/${convId}/toggle-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_ai_active: isAiActive }),
  });
  if (!res.ok) throw new Error(`Failed to toggle AI mode: ${res.statusText}`);
  return res.json();
}

export async function sendManualOperatorMessage(
  convId: string,
  waUserId: string,
  message: string
): Promise<{ status: string; message: ChatMessage }> {
  const res = await fetch(`${API_URL}/api/messages/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: convId,
      wa_user_id: waUserId,
      message,
    }),
  });
  if (!res.ok) throw new Error(`Failed to send operator message: ${res.statusText}`);
  return res.json();
}

export async function fetchBookings(businessId?: string): Promise<Booking[]> {
  const url = businessId ? `${API_URL}/api/bookings?business_id=${businessId}` : `${API_URL}/api/bookings`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch bookings: ${res.statusText}`);
  return res.json();
}

export async function createBooking(data: {
  client_name?: string;
  patient_name?: string;
  phone: string;
  slot_time: string;
  service: string;
  provider_name?: string;
  notes?: string;
  conversation_id?: string;
  business_id?: string;
}): Promise<{ status: string; booking: Booking }> {
  const res = await fetch(`${API_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to create booking: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBusinessConfig(businessId: string = "default_business"): Promise<BusinessConfig> {
  const res = await fetch(`${API_URL}/api/business/config?business_id=${businessId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch business config: ${res.statusText}`);
  return res.json();
}

export async function updateBusinessConfig(
  config: Partial<BusinessConfig>,
  businessId: string = "default_business"
): Promise<{ status: string; config: BusinessConfig }> {
  const res = await fetch(`${API_URL}/api/business/config?business_id=${businessId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to update business config: ${res.statusText}`);
  return res.json();
}

export async function applyIndustryPreset(
  preset: IndustryType,
  businessId: string = "default_business"
): Promise<{ status: string; config: BusinessConfig }> {
  const res = await fetch(`${API_URL}/api/business/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset, business_id: businessId }),
  });
  if (!res.ok) throw new Error(`Failed to apply preset: ${res.statusText}`);
  return res.json();
}

export async function fetchAnalytics(businessId: string = "default_business"): Promise<AnalyticsData> {
  const res = await fetch(`${API_URL}/api/business/analytics?business_id=${businessId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch analytics: ${res.statusText}`);
  return res.json();
}

export async function simulateIncomingMessage(
  waUserId: string,
  messageText: string,
  businessId: string = "default_business"
): Promise<any> {
  const res = await fetch(`${API_URL}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wa_user_id: waUserId,
      message_text: messageText,
      business_id: businessId,
    }),
  });
  if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`);
  return res.json();
}

export async function simulateVoiceUpload(
  waUserId: string,
  audioBlob: Blob,
  businessId: string = "default_business"
): Promise<any> {
  const formData = new FormData();
  formData.append("wa_user_id", waUserId);
  formData.append("business_id", businessId);
  formData.append("file", audioBlob, "voice_recording.wav");

  const res = await fetch(`${API_URL}/api/simulate/voice`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Voice simulation failed: ${res.statusText}`);
  return res.json();
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/bookings/${bookingId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to cancel booking: ${res.statusText}`);
  return res.json();
}

export async function rescheduleBooking(bookingId: string, newSlotTime: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/bookings/${bookingId}/reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_slot_time: newSlotTime }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to reschedule booking: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStaff(businessId: string = "default_business"): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/business/staff?business_id=${businessId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.statusText}`);
  return res.json();
}

export async function createStaff(businessId: string, staffData: any): Promise<any> {
  const res = await fetch(`${API_URL}/api/business/staff?business_id=${businessId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(staffData),
  });
  if (!res.ok) throw new Error(`Failed to create staff: ${res.statusText}`);
  return res.json();
}

export async function updateStaff(staffId: string, staffData: any): Promise<any> {
  const res = await fetch(`${API_URL}/api/business/staff/${staffId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(staffData),
  });
  if (!res.ok) throw new Error(`Failed to update staff: ${res.statusText}`);
  return res.json();
}

export async function deleteStaff(staffId: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/business/staff/${staffId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete staff: ${res.statusText}`);
  return res.json();
}

