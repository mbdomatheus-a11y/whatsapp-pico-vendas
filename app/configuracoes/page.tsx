import { PortalShell } from "@/components/portal-shell";
import { AccountsManager } from "@/components/accounts-manager";
import { TestGroupManager } from "@/components/test-group-manager";
import { SettingsManager } from "@/components/settings-manager";
import { LogoManager } from "@/components/logo-manager";
import { getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const { access, groups, selectedGroupId } = await getPortalContext(); const canAdmin = ["master","admin"].includes(access.profile.role);
  return <PortalShell active="configuracoes" title="Configuracoes" description="Contas, identidade e regras" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><SettingsManager canEdit={canAdmin} />{canAdmin && <LogoManager />}{canAdmin && <AccountsManager />}{canAdmin && <TestGroupManager />}</PortalShell>;
}
