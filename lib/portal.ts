import { requireUser } from "@/lib/auth";

export async function getPortalContext() {
  const auth = await requireUser();
  const groups = auth.access.groups.map((item) => ({
    id: item.group_id,
    name: (item.user_groups as unknown as { name?: string } | null)?.name ?? "Grupo",
  }));
  const selectedGroupId = (
    auth.access.preference?.selected_group_id && groups.some((group) => group.id === auth.access.preference?.selected_group_id)
      ? auth.access.preference.selected_group_id
      : groups[0]?.id
  ) ?? "";
  return { ...auth, groups, selectedGroupId };
}
