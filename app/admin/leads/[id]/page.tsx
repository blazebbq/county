import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("staff_auth")?.value === "authenticated";
}

interface DesignSpec {
  intentSummary?: string;
  metal?: { type: string } | null;
  ringSize?: { system: string; value: string } | null;
  complexity?: string | null;
  styleTags?: string[];
}

interface QuoteData {
  retailPriceGBP?: number;
}

export default async function AdminLeadDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    redirect("/");
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          assets: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!lead) notFound();

  const session = lead.session;
  const transcript = JSON.parse(session.transcript || "[]") as Array<{ role: string; content: string }>;
  const designSpec = session.designSpec ? JSON.parse(session.designSpec) as DesignSpec : null;
  const quote = session.quote ? JSON.parse(session.quote) as QuoteData : null;
  const generatedImages = session.assets.filter((a) => a.type === "generated");
  const latestImage = generatedImages[0]; // already sorted DESC

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/leads" className="text-stone-500 hover:text-stone-300 text-sm">← All Leads</Link>
            <h1 className="text-2xl font-bold text-amber-500 mt-1">Lead: {lead.firstName}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            lead.status === "quoted" ? "bg-green-900/50 text-green-400" :
            lead.status === "emailed" ? "bg-blue-900/50 text-blue-400" :
            "bg-stone-700 text-stone-300"
          }`}>
            {lead.status}
          </span>
        </div>

        {/* Lead Info */}
        <div className="bg-stone-900 rounded-xl p-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">First Name</p>
            <p className="text-stone-100 font-medium">{lead.firstName}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Email</p>
            <p className="text-stone-100">{lead.email}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Phone</p>
            <p className="text-stone-100">{lead.phone}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Created</p>
            <p className="text-stone-300 text-sm">
              {lead.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {" at "}
              {lead.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Session ID</p>
            <p className="text-stone-400 font-mono text-sm">{session.id}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Session Status</p>
            <p className="text-stone-300">{session.status}</p>
          </div>
        </div>

        {/* Design Spec Summary */}
        {designSpec && (
          <div className="bg-stone-900 rounded-xl p-5">
            <h2 className="text-amber-500 font-semibold text-sm uppercase tracking-widest mb-3">Design Summary</h2>
            {designSpec.intentSummary && <p className="text-stone-300 mb-3">{designSpec.intentSummary}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {designSpec.metal && (
                <><span className="text-stone-500">Metal:</span><span className="text-stone-200">{designSpec.metal.type}</span></>
              )}
              {designSpec.ringSize && (
                <><span className="text-stone-500">Ring Size:</span><span className="text-stone-200">{designSpec.ringSize.system} {designSpec.ringSize.value}</span></>
              )}
              {designSpec.complexity && (
                <><span className="text-stone-500">Complexity:</span><span className="text-stone-200">{designSpec.complexity}</span></>
              )}
              {designSpec.styleTags && designSpec.styleTags.length > 0 && (
                <><span className="text-stone-500">Style:</span><span className="text-stone-200">{designSpec.styleTags.join(", ")}</span></>
              )}
            </div>
          </div>
        )}

        {/* Quote + Image row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quote */}
          <div className="bg-stone-900 rounded-xl p-5">
            <h2 className="text-amber-500 font-semibold text-sm uppercase tracking-widest mb-3">Quote</h2>
            {quote?.retailPriceGBP ? (
              <p className="text-3xl font-bold text-stone-100">£{quote.retailPriceGBP.toLocaleString()}</p>
            ) : (
              <p className="text-stone-500 text-sm">No quote generated</p>
            )}
            {quote && (
              <a
                href={`/api/session/${session.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-amber-500 hover:text-amber-400 text-sm font-medium"
              >
                📄 Download PDF →
              </a>
            )}
          </div>

          {/* Latest image */}
          <div className="bg-stone-900 rounded-xl p-5">
            <h2 className="text-amber-500 font-semibold text-sm uppercase tracking-widest mb-3">
              Latest Render {generatedImages.length > 1 && `(${generatedImages.length} total)`}
            </h2>
            {latestImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestImage.path}
                alt="Ring concept render"
                className="w-full max-w-xs rounded-lg border border-stone-700"
              />
            ) : (
              <p className="text-stone-500 text-sm">No image generated</p>
            )}
          </div>
        </div>

        {/* Conversation transcript */}
        <div className="bg-stone-900 rounded-xl p-5">
          <h2 className="text-amber-500 font-semibold text-sm uppercase tracking-widest mb-3">
            Conversation ({transcript.length} messages)
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transcript.length === 0 ? (
              <p className="text-stone-500 text-sm">No messages yet.</p>
            ) : (
              transcript.map((msg, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-stone-800 text-stone-200" : "bg-stone-800/50 text-stone-400"}`}>
                  <span className={`font-semibold ${msg.role === "user" ? "text-amber-400" : "text-stone-500"}`}>
                    {msg.role === "user" ? "Customer" : "Assistant"}:{" "}
                  </span>
                  <span className="whitespace-pre-wrap">
                    {msg.content.length > 400 ? msg.content.slice(0, 400) + "…" : msg.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
