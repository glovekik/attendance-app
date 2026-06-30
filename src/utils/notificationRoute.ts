/**
 * Maps a notification payload to the in-app route to open, gated by the
 * recipient's role. Returns null when the user's role can't access the
 * target page — so we never redirect into a 403/empty screen.
 *
 * Used by BOTH the push handler (app/_layout.tsx) and the in-app bell list
 * (app/notifications.tsx) so a tap behaves identically wherever it comes
 * from. `payload` must carry the notification `type` plus any ids
 * (taskId, channelId, …). For bell items, pass `{ ...item.data, type: item.type }`.
 */
export const resolveNotificationRoute = (
  payload: any,
  role?: string | null
): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const type: string = payload.type || "";
  const isHrOrCeo = role === "HR" || role === "CEO";
  const isManagerial = isHrOrCeo || role === "MANAGER";

  switch (type) {
    // ===== Employee-facing (recipient = the affected employee) =====
    case "task_assigned":
    case "task_complete":
    case "task_completed":
      return payload.taskId ? `/tasks/${payload.taskId}` : "/tasks";
    case "leave_decision":
    case "leave_decided":
      return "/leaves";
    case "reimbursement_decision":
      return "/reimbursements";
    case "correction_decision":
      return "/corrections";
    case "manual_attendance_decision":
      return "/manual-request";
    case "timesheet_decision":
      return "/my-timesheet";
    case "resignation_decision":
      return "/exit";
    case "goal_assigned":
      return "/my-goals";
    case "review_submitted":
      return "/my-reviews";
    case "payslip_ready":
      return "/my-payroll";
    case "asset_assigned":
      return "/assets";
    case "checkout_reminder":
      return "/attendance";
    case "todo_reminder":
      return "/todos";
    case "chat_mention":
    case "chat_message":
      if (payload.channelType === "team" && payload.channelId)
        return `/chat/team/${payload.channelId}`;
      return "/chat/office";

    // ===== Approver-facing (managerial only; plain users can't act here) =====
    case "leave_requests":
      if (!isManagerial) return null;
      return isHrOrCeo ? "/leave-requests" : "/manager-leaves";
    case "reimbursement_requests":
      if (!isManagerial) return null;
      return isHrOrCeo ? "/hr-reimbursements" : "/manager-reimbursements";
    case "manual_requests":
    case "manual_attendance_requests":
      if (!isManagerial) return null;
      return isHrOrCeo ? "/hr-manual-requests" : "/manager-manual-requests";
    case "timesheet_submitted":
      if (!isManagerial) return null;
      return isHrOrCeo ? "/hr-timesheets" : "/manager-timesheets";
    case "correction_requests":
      // HR is authorised on the manager queue too; the screen serves both.
      return isManagerial ? "/manager-corrections" : null;
    case "review_self_eval_submitted":
      return isManagerial ? "/manager-reviews" : null;
    case "onboarding_completed":
      return isHrOrCeo ? "/onboardings" : "/my-onboarding";
    case "resignation_submitted":
      return isHrOrCeo ? "/exits" : null;

    // ===== HR-owned events =====
    case "asset_issue_reported":
      return isHrOrCeo ? "/asset-reports" : null;
    case "interview_feedback_submitted":
      return isHrOrCeo ? "/hr-interviews" : null;

    default:
      // Unknown type — don't navigate; the bell list still shows it.
      return null;
  }
};
