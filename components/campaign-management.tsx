"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CampaignManagement({ campaignId, campaignName, archived }: { campaignId: string; campaignName: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"archive" | "delete" | null>(null);
  const [message, setMessage] = useState("");

  async function toggleArchive() {
    setBusy("archive"); setMessage("");
    const response = await fetch(`/api/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !archived }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? (archived ? "Campanha desarquivada" : "Campanha arquivada") : body.error ?? "Falha ao atualizar campanha");
    setBusy(null); if (response.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Primeira confirmacao: deseja excluir a campanha ${campaignName}?`)) return;
    if (!window.confirm("Segunda confirmacao: esta acao remove a campanha e sua fila e nao pode ser desfeita. Confirma?")) return;
    setBusy("delete"); setMessage("");
    const response = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Campanha excluida" : body.error ?? "Falha ao excluir campanha");
    setBusy(null); if (response.ok) router.refresh();
  }

  return <div className="actions campaign-management">
    <button className="small secondary" disabled={!!busy} onClick={toggleArchive}>{busy === "archive" ? "Processando..." : archived ? "Desarquivar" : "Arquivar"}</button>
    <button className="small danger" disabled={!!busy} onClick={remove}>{busy === "delete" ? "Excluindo..." : "Excluir"}</button>
    {message && <span className="action-message">{message}</span>}
  </div>;
}
