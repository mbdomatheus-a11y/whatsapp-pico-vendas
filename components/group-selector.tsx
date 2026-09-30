"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const ALL_GROUPS = "__all__";

export function GroupSelector({ groups, selected, canViewAll = false }: { groups: { id: string; name: string }[]; selected?: string | null; canViewAll?: boolean }) {
  const router = useRouter(); const [value, setValue] = useState(selected ?? groups[0]?.id ?? ""); const [busy, setBusy] = useState(false);
  async function change(next: string) {
    setValue(next); setBusy(true);
    if (next === ALL_GROUPS) {
      router.push("/dashboard?grupo=todos");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedGroupId: next }) });
    if (response.ok) router.push("/dashboard");
    else setValue(selected ?? groups[0]?.id ?? "");
    setBusy(false);
  }
  return <label className="group-selector"><span>{busy ? "Alterando visualizacao..." : "Visualizacao"}</span><select value={value} disabled={busy} onChange={(event) => change(event.target.value)}>{canViewAll && <option value={ALL_GROUPS}>Todos os grupos</option>}{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>{canViewAll && <small>Master: acesso a todos</small>}</label>;
}
