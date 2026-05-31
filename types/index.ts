export type UserRole = 'admin' | 'manager' | 'support'

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface User {
  id: string
  email: string
  role: UserRole
  store_id: string
  created_at: string
}

export interface Store {
  id: string
  shop_domain: string
  access_token: string
  name: string
  email: string
  created_at: string
}

export interface Customer {
  id: string
  store_id: string
  shopify_customer_id: string
  name: string
  email: string
  created_at: string
}

export interface Order {
  id: string
  store_id: string
  customer_id: string
  shopify_order_id: string
  order_number: string
  product_name: string
  shipping_address: string
  status: OrderStatus
  tracking_id: string
  created_at: string
  completed_at: string | null
}

export interface TrackingRecord {
  id: string
  order_id: string
  tracking_id: string
  current_day: number
  last_updated: string
  expires_at: string
}

export interface TrackingEvent {
  id: string
  tracking_record_id: string
  day: number
  title: string
  description: string
  triggered_at: string
}

export interface EmailLog {
  id: string
  order_id: string
  tracking_id: string
  email_to: string
  subject: string
  status: 'sent' | 'failed'
  sent_at: string
}

export interface Settings {
  id: string
  store_id: string
  tracking_duration_days: number
  email_from_name: string
  tracking_page_title: string
  timeline_milestones: TimelineMilestone[]
}

export interface TimelineMilestone {
  day: number
  title: string
  description: string
}
