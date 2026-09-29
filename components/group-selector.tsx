"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GroupSelector({ groups, selected }: { groups: { id: string; name: string }[]; selected?: string | null }) {
  const router = useRouter(); const [value, setValue] = useState(selected ?? groups[0]?.id ?? ""); const [busy, setBusy] = useState(false);
  async function change(next: string) { setValue(next); setBusy(true); await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedGroupId: next }) }); router.refresh(); setBusy(false); }
  return <label className="group-selector">{busy ? "Trocando grupo..." : "Grupo ativo"}<select value={value} disabled={busy} onChange={(event) => change(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>;
}
