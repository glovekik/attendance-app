import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Teams became Projects in Phase 4. The Phase 1 migration preserved the team
 * `_id` as the project `_id`, so the same id resolves straight through.
 */
export default function TeamDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/projects/${id}` as any} />;
}
