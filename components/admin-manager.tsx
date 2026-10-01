"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Group = { id: string; name: string };
type User = { user_id: string; full_name: string; maskedPhone: string; email: string; role: string; active: boolean; must_change_password: boolean; groups: Group[] };

export function AdminManager({ isMaster }: { isMaster: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    const [groupsResponse, usersResponse] = await Promise.all([fetch("/api/admin/groups", { cache: "no-store" }), fetch("/api/admin/users", { cache: "no-store" })]);
    const groupBody = await groupsResponse.json(); const userBody = await usersResponse.json();
    if (groupsResponse.ok) setGroups(groupBody.groups ?? []);
    if (usersResponse.ok) setUsers(userBody.users ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!isMaster) return;
    void fetch("/api/admin/mfa-policy", { cache: "no-store" }).then((response) => response.json()).then((body) => {
      if (typeof body.required === "boolean") setMfaRequired(body.required);
    });
  }, [isMaster]);

  async function toggleMfaPolicy() {
    if (mfaRequired === null) return;
    const next = !mfaRequired;
    if (!next && !window.confirm("Desativar o 2FA reduz a seguranca de acesso para todos os usuarios. Os autenticadores cadastrados serao preservados. Deseja continuar?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/mfa-policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ required: next }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { setMfaRequired(body.required); setMessage(body.required ? "2FA reativado para todos os usuarios" : "2FA temporariamente desativado para todos os usuarios"); }
      else setMessage(body.error ?? "Falha ao alterar a exigencia de 2FA");
    } catch { setMessage("Falha de conexao ao alterar a exigencia de 2FA"); }
    finally { setBusy(false); }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setTemporaryPassword("");
    const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), fullName: data.get("fullName"), phone: data.get("phone"), role: data.get("role"), groupIds: data.getAll("groupIds") }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setTemporaryPassword(body.temporaryPassword); setMessage("Usuario criado. Copie a senha temporaria agora."); form.reset(); await load(); }
    else setMessage(body.error ?? "Falha ao criar usuario");
    setBusy(false);
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch("/api/admin/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name") }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? "Grupo criado" : body.error ?? "Falha ao criar grupo");
    if (response.ok) { form.reset(); await load(); } setBusy(false);
  }

  async function action(userId: string, actionName: "reset-password" | "reset-mfa") {
    const label = actionName === "reset-password" ? "redefinir a senha" : "remover o 2FA";
    if (!window.confirm(`Confirma ${label} deste usuario?`)) return;
    setBusy(true); setMessage(""); setTemporaryPassword("");
    const response = await fetch(`/api/admin/users/${userId}/${actionName}`, { method: "POST" }); const body = await response.json().catch(() => ({}));
    if (response.ok) { setMessage(actionName === "reset-password" ? "Senha redefinida. Copie a senha temporaria agora." : "2FA removido. O usuario devera configurar novamente."); if (body.temporaryPassword) setTemporaryPassword(body.temporaryPassword); }
    else setMessage(body.error ?? "Falha na operacao"); setBusy(false);
  }

  async function toggleUser(user: User) {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/users/${user.user_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: user.role, active: !user.active }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? (user.active ? "Usuario desativado" : "Usuario reativado") : body.error ?? "Falha na operacao"); if (response.ok) await load(); setBusy(false);
  }

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Administracao</p><h1>Usuarios e grupos</h1></div><a className="button secondary" href="/dashboard">Voltar ao painel</a></header>
    {isMaster && <section className="panel security-policy"><div><p className="eyebrow">Seguranca de acesso</p><h2>Autenticacao em dois fatores</h2><p className="muted">Esta regra vale para todos os usuarios. Desativar nao remove os autenticadores cadastrados e toda alteracao fica registrada na auditoria.</p></div><div className="security-policy-action"><span className={`badge ${mfaRequired === false ? "pausada" : "concluida"}`}>{mfaRequired === null ? "Consultando..." : mfaRequired ? "2FA obrigatorio" : "2FA desativado"}</span><button className={mfaRequired === false ? "whatsapp-action" : "danger"} disabled={busy || mfaRequired === null} onClick={toggleMfaPolicy}>{busy ? "Alterando..." : mfaRequired === false ? "Reativar 2FA" : "Desativar 2FA"}</button></div></section>}
    {isMaster && <section className="panel"><div className="panel-heading"><div><h2>Grupos de operacao</h2><p>Separe usuarios e campanhas por area de responsabilidade.</p></div></div><form className="inline-form" onSubmit={createGroup}><label>Nome do grupo<input name="name" required maxLength={100} /></label><button disabled={busy}>Criar grupo</button></form></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Novo usuario</h2><p>O usuario trocará a senha e ativará o autenticador no primeiro acesso.</p></div></div><form className="stack" onSubmit={createUser}><div className="form-grid"><label>Nome completo<input name="fullName" required /></label><label>E-mail corporativo<input name="email" type="email" pattern=".+@pernambucanas\.com\.br" required /></label><label>Celular<input name="phone" inputMode="tel" placeholder="5511999999999" required /></label><label>Perfil<select name="role" defaultValue="operador"><option value="admin">Administrador</option><option value="operador">Operador</option><option value="consulta">Consulta</option></select></label></div><fieldset><legend>Grupos</legend><div className="checkbox-grid">{groups.map((group, index) => <label className="check" key={group.id}><input type="checkbox" name="groupIds" value={group.id} defaultChecked={index === 0} />{group.name}</label>)}</div></fieldset><button disabled={busy}>Criar usuario</button></form>{temporaryPassword && <div className="credential-box"><strong>Senha temporaria, exibida somente agora</strong><code>{temporaryPassword}</code><button className="small secondary" onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Copiar senha</button></div>}{message && <p className="action-message">{message}</p>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Usuarios administrados</h2><p>O administrador master nao aparece nesta lista e somente pode ser removido diretamente no banco.</p></div><button className="small secondary" onClick={load}>Atualizar</button></div><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Perfil</th><th>Grupos</th><th>Status</th><th>Acoes</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><strong>{user.full_name}</strong><br/><span className="muted">{user.email}</span><br/><span className="muted">{user.maskedPhone}</span></td><td>{user.role}</td><td>{user.groups.map((group) => group.name).join(", ")}</td><td><span className={`badge ${user.active ? "concluida" : "pausada"}`}>{user.active ? (user.must_change_password ? "Primeiro acesso pendente" : "Ativo") : "Inativo"}</span></td><td><div className="actions"><button className="small secondary" disabled={busy} onClick={() => action(user.user_id, "reset-password")}>Redefinir senha</button>{isMaster && <button className="small secondary" disabled={busy} onClick={() => action(user.user_id, "reset-mfa")}>Redefinir 2FA</button>}<button className={`small ${user.active ? "danger" : ""}`} disabled={busy} onClick={() => toggleUser(user)}>{user.active ? "Desativar" : "Reativar"}</button></div></td></tr>)}</tbody></table></div></section>
  </main>;
}
