import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Team-scoped task creation moved onto the project screen in Phase 4, where
 * it runs through the project-manager permission check and the assignee
 * picker is bound to actual project members.
 *
 * `teamId` and `projectId` are the same value — Phase 1 preserved the id.
 */
export default function NewTaskRedirect() {
  const { teamId, projectId } = useLocalSearchParams<{
    teamId?: string;
    projectId?: string;
  }>();
  const id = projectId || teamId;
  return <Redirect href={(id ? `/projects/${id}` : "/projects") as any} />;
}
