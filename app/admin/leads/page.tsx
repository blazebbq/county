import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("staff_auth")?.value === "authenticated";
}

export default async function AdminLeadsPage() {
  if (!(await isAuthenticated())) {
    redirect("/");
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      session: {
        select: {
          id: true,
          status: true,
          quote: true,
          assets: { where: { type: "generated" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-amber-500">Admin — Customer Leads</h1>
          <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm">← Back to Kiosk</Link>
        </div>

        {leads.length === 0 ? (
          <div className="bg-stone-900 rounded-xl p-8 text-center text-stone-500">
            No leads yet. Start a kiosk session to capture your first lead.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-stone-900 rounded-xl overflow-hidden text-sm">
              <thead>
                <tr className="bg-stone-800 text-stone-400 uppercase text-xs tracking-widest">
                  <th className="px-4 py-3 text-left">Date/Time</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Session</th>
                  <th className="px-4 py-3 text-left">Quote</th>
                  <th className="px-4 py-3 text-left">Image</th>
                  <th className="px-4 py-3 text-left">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {leads.map((lead) => {
                  const hasQuote = !!lead.session.quote;
                  const hasImage = lead.session.assets.length > 0;
                  return (
                    <tr key={lead.id} className="hover:bg-stone-800/50 transition-colors">
                      <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                        {lead.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                        {lead.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-stone-100 font-medium">{lead.firstName}</td>
                      <td className="px-4 py-3 text-stone-300">{lead.email}</td>
                      <td className="px-4 py-3 text-stone-300">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          lead.status === "quoted" ? "bg-green-900/50 text-green-400" :
                          lead.status === "emailed" ? "bg-blue-900/50 text-blue-400" :
                          lead.status === "engaged" ? "bg-amber-900/50 text-amber-400" :
                          "bg-stone-700 text-stone-300"
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 font-mono text-xs">{lead.sessionId.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        {hasQuote ? <span className="text-green-400">✓</span> : <span className="text-stone-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {hasImage ? <span className="text-green-400">✓</span> : <span className="text-stone-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="text-amber-500 hover:text-amber-400 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
