import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { listTechnicians, setUserAdmin, isCurrentUserAdmin } from "@/lib/admin.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";

const usersQuery = queryOptions({ queryKey: ["admin-users"], queryFn: () => listTechnicians() });
const meQuery = queryOptions({ queryKey: ["is-admin"], queryFn: () => isCurrentUserAdmin() });

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.isAdmin) throw new Error("Forbidden: admin only");
    await context.queryClient.ensureQueryData(usersQuery);
  },
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function UsersPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { user_id: string; is_admin: boolean }) => setUserAdmin({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Users & access"
        description="Grant or revoke access to the Database section. Only admins can view this page."
      />
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Roles</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.roles.includes("admin");
                const isSelf = me.isAdmin && u.id === (users.find((x) => x.id === u.id)?.id) && false;
                void isSelf;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">{u.full_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">technician</span>
                      ) : (
                        u.roles.map((r) => (
                          <span
                            key={r}
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mr-1 ${
                              r === "admin" ? "bg-primary/15 text-primary" : "bg-muted"
                            }`}
                          >
                            {r}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={isAdmin ? "outline" : "default"}
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ user_id: u.id, is_admin: !isAdmin })}
                      >
                        {isAdmin ? (
                          <><Shield className="h-4 w-4 mr-1" /> Revoke admin</>
                        ) : (
                          <><ShieldCheck className="h-4 w-4 mr-1" /> Make admin</>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}