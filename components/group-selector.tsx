"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GroupSelector({ groups, selected }: { groups: { id: string; name: string }[]; selected?: string | null }) {
  const router = useRouter(); const [value, setValue] = useState(selected ?? groups[0]?.id ?? "");
  async function change(next: string) { setValue(next); await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedGroupId: next }) }); router.refresh(); }
  return <label className="group-selector">Grupo ativo<select value={value} onChange={(event) => change(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>;
}
