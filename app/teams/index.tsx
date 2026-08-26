import { Redirect } from "expo-router";

/**
 * Teams were merged into Projects in Phase 4 — a project *is* the team, with
 * membership history and its own chat. This redirect keeps old links, saved
 * tabs and notification payloads working.
 */
export default function TeamsRedirect() {
  return <Redirect href="/projects" />;
}
