import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function supabaseClientSignOut() {
  try {
    await createSupabaseBrowserClient().auth.signOut();
  } catch {
    /* ignore */
  }
}
