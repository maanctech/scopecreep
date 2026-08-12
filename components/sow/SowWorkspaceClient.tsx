"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BoundaryItem, SowWorkspace } from "@/lib/sow/types";
import { BOUNDARY_TYPES } from "@/lib/sow/types";

export function SowWorkspaceClient({ projectId, initialWorkspace, canEdit }: { projectId: string; initialWorkspace: SowWorkspace; canEdit: boolean }) {
  const router = useRouter();
  const displayedBoundaryMap = initialWorkspace.draftBoundaryMap ?? initialWorkspace.activeBoundaryMap;
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [items, setItems] = useState<BoundaryItem[]>(displayedBoundaryMap?.items || []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [syncedBoundaryMap, setSyncedBoundaryMap] = useState(displayedBoundaryMap);

  // router.refresh() delivers a fresh workspace prop, and the editable items
  // have to follow it. Adjusting during render rather than in an effect means
  // the stale items are never painted first.
  if (syncedBoundaryMap !== displayedBoundaryMap) {
    setSyncedBoundaryMap(displayedBoundaryMap);
    setItems(displayedBoundaryMap?.items || []);
  }

  async function submitVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("version"); setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = mode === "upload" ? await fetch(`/api/projects/${projectId}/sow`, { method: "POST", body: form }) : await fetch(`/api/projects/${projectId}/sow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: String(form.get("text") || ""), changeNote: String(form.get("changeNote") || "") }) });
      const data = await response.json() as { error?: string };

      if (!response.ok) throw new Error(data.error || "Could not save the SOW version.");

      setMessage({ kind: "success", text: "New SOW version saved. Its boundary map must be reviewed and approved." });
      router.refresh();
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save the SOW version." }); }
    finally { setBusy(null); }
  }

  async function generateReview() {
    setBusy("analyze"); setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sow/analyze`, { method: "POST" });
      const data = await response.json() as { error?: string };

      if (!response.ok) throw new Error(data.error || "Could not generate the review.");

      setMessage({ kind: "success", text: "Draft risk review and boundary map generated. Review every item before approval." });
      router.refresh();
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not generate the review." }); }
    finally { setBusy(null); }
  }

  function updateItem(index: number, field: keyof BoundaryItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function saveMap(approve: boolean) {
    if (!initialWorkspace.draftBoundaryMap) return;

    if (approve && !window.confirm("Approve this boundary map as the authoritative scope reference for future analysis? This stays private and contacts no client.")) return;

    setBusy(approve ? "approve" : "save"); setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sow/boundary`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: initialWorkspace.draftBoundaryMap.id, approve, items: items.map(({ boundaryType, category, description, evidence }) => ({ boundaryType, category, description, evidence })) }) });
      const data = await response.json() as { error?: string };

      if (!response.ok) throw new Error(data.error || "Could not save the boundary map.");

      setMessage({ kind: "success", text: approve ? "Boundary map approved for future analysis. Nothing was sent externally." : "Draft boundary map saved." });
      router.refresh();
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save the boundary map." }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-8">
    {message ? <div role="status" aria-live="polite" className={`
      rounded-md border p-4 text-sm
      ${message.kind === "success" ? `border-signal/25 bg-signal/5 text-signal` : `
        border-critical/25 bg-critical/5 text-critical
      `}
    `}>{message.text}</div> : null}

    <section className="sl-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="
        text-xl font-semibold
      ">Active agreement</h2><p className="mt-2 text-sm text-audit-body">{initialWorkspace.activeVersion ? `Version ${initialWorkspace.activeVersion.versionNumber} / ${initialWorkspace.activeVersion.sourceType}` : "No active version"}</p></div><span className={`
        rounded-md border px-3 py-1 text-sm font-semibold
        ${initialWorkspace.activeBoundaryMap ? `
          border-signal/25 bg-signal/5 text-signal
        ` : `border-audit-amber/30 bg-audit-amber/5 text-audit-amber`}
      `}>{initialWorkspace.activeBoundaryMap ? "Boundary approved" : "Approval required"}</span></div>
      {initialWorkspace.draftBoundaryMap ? <p className="
        mt-3 text-sm font-semibold text-audit-amber
      ">A newer draft review is pending. The approved map remains authoritative until this draft is approved.</p> : null}
      {initialWorkspace.activeVersion ? <details className="mt-5"><summary className="
        cursor-pointer font-medium
      ">Read extracted agreement text</summary><pre className="
        mt-3 max-h-80 overflow-auto rounded-md bg-audit-soft p-4 text-sm/6
        whitespace-pre-wrap
      ">{initialWorkspace.activeVersion.content}</pre></details> : null}
    </section>

    {canEdit ? <section className="sl-panel p-6"><h2 className="
      text-xl font-semibold
    ">Add a new agreement version</h2><p className="
      mt-2 text-sm/6 text-audit-body
    ">Use paste for scanned documents. Upload accepts TXT, DOCX, and text-based PDF up to 10 MB.</p><div className="
      mt-4 flex gap-2
    " role="group" aria-label="SOW source"><button type="button" onClick={() => setMode("paste")} className={`
      h-10 rounded-md border px-4 text-sm font-medium
      ${mode === "paste" ? `border-signal bg-signal text-white` : `
        border-audit-border
      `}
    `}>Paste text</button><button type="button" onClick={() => setMode("upload")} className={`
      h-10 rounded-md border px-4 text-sm font-medium
      ${mode === "upload" ? `border-signal bg-signal text-white` : `
        border-audit-border
      `}
    `}>Upload file</button></div><form onSubmit={submitVersion} className="
      mt-5 grid gap-4
    ">{mode === "paste" ? <label><span className="text-sm font-medium">SOW text</span><textarea name="text" rows={10} required className="
      sl-field mt-2
    " /></label> : <label><span className="text-sm font-medium">SOW file</span><input name="file" type="file" required accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="
      sl-field mt-2 block
    " /></label>}<label><span className="text-sm font-medium">What changed?</span><input name="changeNote" maxLength={500} placeholder="Example: Added signed amendment dated July 22" className="
      sl-field mt-2
    " /></label><button disabled={Boolean(busy)} className="sl-button-primary">{busy === "version" ? "Saving version..." : "Save new version"}</button></form></section> : null}

    <section className="space-y-4"><div className="
      flex flex-wrap items-end justify-between gap-4
    "><div><h2 className="text-xl font-semibold">Risk review</h2><p className="
      mt-2 text-sm text-audit-body
    ">Potential contract weaknesses for professional review. This is not legal advice.</p></div>{canEdit && initialWorkspace.activeVersion ? <button onClick={generateReview} disabled={Boolean(busy)} className="
      sl-button-secondary
    ">{busy === "analyze" ? "Reviewing agreement..." : initialWorkspace.riskReview ? "Regenerate draft review" : "Generate draft review"}</button> : null}</div>{initialWorkspace.riskReview ? <div className="
      sl-panel p-6
    "><p className="leading-7">{initialWorkspace.riskReview.summary}</p><div className="
      mt-5 divide-y divide-audit-border
    ">{initialWorkspace.riskReview.items.length ? initialWorkspace.riskReview.items.map((risk) => <article key={risk.id} className="
      py-4
    "><div className="font-semibold">{risk.severity}: {risk.category}</div><p className="
      mt-2 text-sm/6 text-audit-body
    ">{risk.description}</p><p className="mt-2 text-sm"><strong>Recommendation:</strong> {risk.recommendation}</p><blockquote className="
      mt-2 border-l-2 border-audit-border pl-3 text-sm text-audit-muted
    ">{risk.evidence}</blockquote></article>) : <p className="
      text-sm text-audit-muted
    ">No specific risk items were identified. Review the agreement manually before approval.</p>}</div></div> : <div className="
      rounded-md border border-dashed border-audit-border p-6 text-sm
      text-audit-body
    ">No risk review has been generated for this version.</div>}</section>

    <section className="space-y-4"><div><h2 className="text-xl font-semibold">Scope Boundary Map</h2><p className="
      mt-2 text-sm/6 text-audit-body
    ">A draft becomes authoritative only after a professional approves it.</p></div>{displayedBoundaryMap ? <div className="
      space-y-4
    ">{items.map((item, index) => <fieldset key={item.id || index} disabled={!canEdit || displayedBoundaryMap.status === "Active"} className="
      sl-panel grid gap-4 p-5
    "><legend className="px-2 text-sm font-semibold">Boundary item {index + 1}</legend><div className="
      grid gap-4
      sm:grid-cols-2
    "><label><span className="text-sm font-medium">Boundary type</span><select value={item.boundaryType} onChange={(event) => updateItem(index, "boundaryType", event.target.value)} className="
      sl-field mt-2
    ">{BOUNDARY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label><span className="
      text-sm font-medium
    ">Category</span><input value={item.category} onChange={(event) => updateItem(index, "category", event.target.value)} className="
      sl-field mt-2
    " /></label></div><label><span className="text-sm font-medium">Plain-English boundary</span><textarea value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} rows={2} className="
      sl-field mt-2
    " /></label><label><span className="text-sm font-medium">Agreement evidence</span><textarea value={item.evidence} onChange={(event) => updateItem(index, "evidence", event.target.value)} rows={2} className="
      sl-field mt-2
    " /></label></fieldset>)}{canEdit && initialWorkspace.draftBoundaryMap ? <div className="
      flex flex-wrap gap-3
    "><button onClick={() => saveMap(false)} disabled={Boolean(busy)} className="
      sl-button-secondary
    ">{busy === "save" ? "Saving..." : "Save draft"}</button><button onClick={() => saveMap(true)} disabled={Boolean(busy)} className="
      sl-button-primary
    ">{busy === "approve" ? "Approving..." : "Approve boundary map"}</button></div> : null}</div> : <div className="
      rounded-md border border-dashed border-audit-border p-6 text-sm
      text-audit-body
    ">Generate a draft review to create the first boundary map.</div>}</section>

    <section><h2 className="text-xl font-semibold">Version history</h2><div className="
      sl-table-wrap mt-4
    "><table className="min-w-full text-left text-sm"><thead className="
      bg-audit-soft
    "><tr><th className="p-3">Version</th><th className="p-3">Source</th><th className="
      p-3
    ">Change note</th><th className="p-3">Created</th><th className="p-3">Status</th></tr></thead><tbody className="
      divide-y divide-audit-border
    ">{initialWorkspace.versions.map((version) => <tr key={version.id}><td className="
      p-3 font-medium
    ">v{version.versionNumber}</td><td className="p-3">{version.sourceFilename || version.sourceType}</td><td className="
      p-3
    ">{version.changeNote || "Initial or unspecified"}</td><td className="p-3">{new Date(version.createdAt).toLocaleString()}</td><td className="
      p-3
    ">{version.isActive ? "Active" : "Historical"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
