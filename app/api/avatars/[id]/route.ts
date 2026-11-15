import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isUuid } from "@/lib/search";

const missing = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return missing(401);
  const { id } = await params;
  if (!isUuid(id)) return missing(404);
  try {
    const client = await createClient();
    const mine = await client.from("profiles").select("school_id").eq("id", user.id).single();
    if (mine.error || !mine.data) return missing(503);
    const target = await client.from("profiles").select("avatar_path").eq("id", id).eq("school_id", mine.data.school_id).maybeSingle();
    if (target.error) return missing(503);
    const path = target.data?.avatar_path as string | null;
    if (!path || !path.startsWith(`${id}/`)) return missing(404);
    const { data, error } = await client.storage.from("profile-photos").download(path);
    if (error || !data) return missing(404);
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.type)) return missing(404);
    return new Response(data, { headers: { "Content-Type": data.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return missing(503); }
}
