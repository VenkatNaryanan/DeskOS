import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nypoegvzfuahemjysmmp.supabase.co";
// Clean URL by stripping any /rest/v1 suffix
const supabaseUrl = rawUrl.split("/rest/v1")[0].replace(/\/+$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
