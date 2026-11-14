// Shapes of the rows in our database tables (see supabase/migrations).

export type ItemStatus = "available" | "pending" | "swapped" | "sold";

export type Profile = {
  id: string;
  school_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  style_tags: string[];
  created_at: string;
};

export type Item = {
  id: string;
  owner_id: string;
  school_id: string;
  title: string;
  description: string | null;
  category: string | null;
  size: string | null;
  condition: string | null;
  estimated_value_cents: number;
  style_tags: string[];
  photo_urls: string[];
  status: ItemStatus;
  created_at: string;
};

export type SwapStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export type SwapRequest = {
  id: string;
  requested_item_id: string;
  requester_id: string;
  owner_id: string;
  offered_item_ids: string[];
  cash_amount_cents: number;
  cash_paid_by: "requester" | "owner" | null;
  status: SwapStatus;
  meetup_spot_id: string | null;
  meetup_time: string | null;
  created_at: string;
};
