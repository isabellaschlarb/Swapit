import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { profileFields, PROFILE_BODY_LIMIT } from "@/lib/profile-input";
import { saveProfile, type EditableProfile } from "@/lib/profile-server";
import { boundedBody } from "@/lib/request-body";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Use the profile form on this site." }, 403);
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Please sign in again." }, 401);
  let input;
  try {
    const body = await boundedBody(request, PROFILE_BODY_LIMIT);
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    input = profileFields(form);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Please check the form.";
    return reply({ error: message }, message === "The upload is too large." ? 413 : 400);
  }
  try {
    const client = await createClient();
    const { data, error } = await client.from("profiles").select("id, school_id, display_name, bio, avatar_path").eq("id", user.id).single();
    if (error || !data) return reply({ error: "Your school profile couldn't load. Reload and try again." }, 503);
    const result = await saveProfile(client, data as EditableProfile, input);
    return result.ok ? reply({ saved: true }) : reply({ error: result.message }, 409);
  } catch (cause) {
    // Photo validation messages contain only fixed text, never provider objects.
    if (cause instanceof Error && /^(Choose a JPEG|That file doesn't match)/.test(cause.message)) {
      return reply({ error: cause.message }, 400);
    }
    return reply({ error: "Your profile couldn't save. Reload before retrying; your previous photo has been kept." }, 503);
  }
}
