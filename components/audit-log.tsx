"use client";
import { useEffect, useState } from "react";

type Log = { id: number; action: string; entity_type?: string; created_at: string; actorName?: string };
export function AuditLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => { void fetch("/api/audit").then((response) => response.json()).then((body) => setLogs(body.logs ?? [])); }, []);
  return <section className="panel" id="auditoria"><div className="panel-heading"><div><h2>Auditoria</h2><p>Entradas e atividades administrativas mais recentes.</p></div></div><div className="table-wrap"><table><thead><tr><th>Quando</th><th>Usuario</th><th>Atividade</th><th>Objeto</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("pt-BR")}</td><td>{log.actorName ?? "Sistema"}</td><td>{log.action}</td><td>{log.entity_type ?? "-"}</td></tr>)}</tbody></table></div></section>;
}
