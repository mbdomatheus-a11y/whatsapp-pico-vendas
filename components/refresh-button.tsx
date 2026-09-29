"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [label, setLabel] = useState("Atualizar dados");
  const [pending, startTransition] = useTransition();
  function refresh() {
    setLabel("Atualizando...");
    window.dispatchEvent(new Event("portal-refresh"));
    startTransition(() => {
      router.refresh();
      window.setTimeout(() => setLabel("Atualizar dados"), 700);
    });
  }
  return <button type="button" className="secondary refresh-button" disabled={pending} onClick={refresh}>{pending ? "Atualizando..." : label}</button>;
}
