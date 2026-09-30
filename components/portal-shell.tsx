import type { ReactNode } from "react";
import { GroupSelector } from "@/components/group-selector";
import { RefreshButton } from "@/components/refresh-button";
import { SchedulerRunner } from "@/components/scheduler-runner";
import { MaintenanceRunner } from "@/components/maintenance-runner";

type Group = { id: string; name: string };

const NAVIGATION = [
  ["visao", "/dashboard", "Visao geral"],
  ["planejamento", "/planejamento", "Preparar envio"],
  ["campanhas", "/campanhas", "Campanhas"],
  ["fila", "/fila", "Fila e historico"],
  ["configuracoes", "/configuracoes", "Configuracoes"],
] as const;

export function PortalShell({
  children,
  active,
  title,
  description,
  fullName,
  role,
  groups,
  selectedGroupId,
  viewAllGroups = false,
}: {
  children: ReactNode;
  active: string;
  title: string;
  description?: string;
  fullName: string;
  role: string;
  groups: Group[];
  selectedGroupId: string;
  viewAllGroups?: boolean;
}) {
  const canAdmin = ["master", "admin"].includes(role);
  return <main className="app-shell">
    <SchedulerRunner />
    <MaintenanceRunner />
    <header className="topbar">
      <a className="brand-lockup" href="/dashboard" aria-label="WhatsApp OK, inicio">
        <img className="brand-logo" src="/api/branding/logo" alt="" />
        <span><strong>WhatsApp <i>OK</i></strong><small>{description ?? "Central de comunicacoes"}</small></span>
      </a>
      <div className="header-actions">
        <GroupSelector groups={groups} selected={viewAllGroups ? "__all__" : selectedGroupId} canViewAll={role === "master"} />
        <RefreshButton />
        {canAdmin && <a className="button secondary" href="/admin">Administracao</a>}
        <form action="/api/auth/logout" method="post"><button className="secondary">Sair</button></form>
      </div>
    </header>
    <nav className="section-nav" aria-label="Navegacao principal">
      {NAVIGATION.map(([key, href, label]) => <a key={key} className={active === key ? "active" : ""} href={href}>{label}</a>)}
    </nav>
    <section className="page-heading"><div><p className="eyebrow">WhatsApp OK</p><h1>{title}</h1><p className="muted">Ola, {fullName}</p></div></section>
    {children}
  </main>;
}
