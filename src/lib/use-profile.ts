import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  role: "owner" | "admin" | "employee";
  color: string;
  created_at: string;
  is_active: boolean;
  avatar_url: string | null;
  email: string | null;
};

const PROFILE_COLUMNS = "id, user_id, full_name, role, color, created_at, is_active, avatar_url";

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, email: null } as Profile) : null;
    },
    staleTime: 30_000,
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Omit<Profile, "email">[]).map((p) => ({ ...p, email: null })) as Profile[];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Admin/owner-only: returns a map of profile id -> email.
 * Backed by the `get_profile_emails` RPC which is gated server-side by `is_admin_or_owner()`.
 * For non-admins the RPC returns no rows, so the resulting map is empty.
 */
export function useProfileEmails(enabled: boolean) {
  return useQuery({
    queryKey: ["profile-emails"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_emails");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as Array<{ id: string; email: string | null }>) {
        if (row.email) map.set(row.id, row.email);
      }
      return map;
    },
    staleTime: 30_000,
  });
}
