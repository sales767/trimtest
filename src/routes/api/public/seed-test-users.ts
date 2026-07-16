import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seed-test-users")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const users = [
          { email: "admin@niviuk.test", password: "Admin1234!", full_name: "Admin Niviuk", admin: true },
          { email: "tech@niviuk.test", password: "Tech1234!", full_name: "Tech Niviuk", admin: false },
        ];
        const results: Array<{ email: string; id: string; admin: boolean }> = [];
        for (const u of users) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name: u.full_name },
          });
          let id = created?.user?.id;
          if (error && !id) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const match = list?.users.find((x) => x.email === u.email);
            if (!match) throw new Error(u.email + ": " + error.message);
            id = match.id;
            await supabaseAdmin.auth.admin.updateUserById(id, { password: u.password, email_confirm: true });
          }
          if (u.admin && id) {
            await supabaseAdmin.from("user_roles").upsert(
              { user_id: id, role: "admin" },
              { onConflict: "user_id,role" },
            );
          }
          results.push({ email: u.email, id: id!, admin: u.admin });
        }
        return new Response(JSON.stringify({ ok: true, users: results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});