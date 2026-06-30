export type Role = "HR" | "MANAGER" | "USER" | "CEO";

export type UserTag =
  | "Employee"
  | "Consultant"
  | "Intern"
  | "Manager"
  | "HR"
  | "Founder"
  | "CEO";

export type UserStatus =
  | "Active"
  | "Inactive"
  | "OnLeave"
  | "Terminated";

export const USER_TAGS: UserTag[] = [
  "Employee",
  "Consultant",
  "Intern",
  "Manager",
  "HR",
  "Founder",
  "CEO",
];

export const USER_STATUSES: UserStatus[] = [
  "Active",
  "Inactive",
  "OnLeave",
  "Terminated",
];

export interface WorkInfo {
  departmentId?: string | null;
  jobPosition?: string;
  jobTitle?: string;
  reportingManagerId?: string | null;
  projectManagerIds?: string[];
  workAddress?: string;
  workLocation?: string;
  usualWorkLocation?: {
    monday?: string | null;
    tuesday?: string | null;
    wednesday?: string | null;
    thursday?: string | null;
    friday?: string | null;
    saturday?: string | null;
    sunday?: string | null;
  };
  notes?: string;
}

export interface PersonalAddress {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country?: string;
}

export interface Education {
  certificationLevel?:
    | "Graduate"
    | "Bachelor"
    | "Master"
    | "Doctor"
    | "Other";
  fieldOfStudy?: string;
}

export interface PersonalInfo {
  personalEmail?: string;
  phone?: string;
  legalName?: string;
  birthday?: string;
  placeOfBirth?: string;
  gender?: string;
  disabled?: boolean;
  bloodGroup?: string;
  maritalStatus?: string;
  address?: PersonalAddress;
  education?: Education;
}

export interface BankAccount {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  accountHolderName?: string;
}

export interface EmergencyContact {
  contactName?: string;
  relationship?: string;
  phone?: string;
}

export interface ProfileDocuments {
  idCardCopy?: string;
  aadhaarCopy?: string;
  panCopy?: string;
  tenth?: string;
  inter?: string;
  ug?: string;
  pg?: string;
  phd?: string;
  offerLetter?: string;
  experienceLetter?: string;
  resume?: string;
  passport?: string;
  relievingLetter?: string;
  salarySlips?: string[];
  certifications?: string[];
}

export interface Statutory {
  pan?: string;
  uan?: string;
  pfAccountNumber?: string;
  esiNumber?: string;
}

export type WageType = "Fixed Wage" | "Hourly Wage";
export type WageDuration =
  | "Year"
  | "Half-Year"
  | "Quarter"
  | "2 Months"
  | "Month"
  | "Half-Month"
  | "2 Weeks"
  | "Week"
  | "Day";
export type EmployeeType =
  | "Full-time"
  | "Part-time"
  | "Internship"
  | "Contract"
  | "Consultant";

export interface ContractInfo {
  contractStartDate?: string;
  contractEndDate?: string | null;
  wageType?: WageType;
  wage?: number;
  wageDuration?: WageDuration;
  employeeType?: EmployeeType;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tag?: UserTag;
  employeeCode?: string;
  workPhone?: string;
  joiningDate?: string;
  status?: UserStatus;
  profilePictureUrl?: string;
  ledTeamIds?: string[];
  memberOfTeamIds?: string[];
  // Expanded org & profile (Phase A)
  departmentId?: string | null;
  reportingManagerId?: string | null;
  projectManagerIds?: string[];
  work?: WorkInfo;
  personal?: PersonalInfo;
  bankAccounts?: BankAccount[];
  emergencyContact?: EmergencyContact;
  documents?: ProfileDocuments;
  statutory?: Statutory;
  contract?: ContractInfo;
  // Termination metadata — populated when status=Terminated.
  terminationReason?: string | null;
  terminatedAt?: string | null;
  terminatedBy?: string | null;
}

export interface Team {
  id: string;
  name: string;
  teamLeadId: string;
  memberIds: string[];
  leadName?: string;
  members?: User[];
  teamLead?: { id: string; name: string; email: string };
}

export type TaskStatus = "PENDING" | "ONGOING" | "COMPLETED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  text: string;
  createdAt: string;
}

export type CorrectionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

// ===== EXPENSE =====
export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  receiptUrl?: string;
  vendor?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface ExpenseSummary {
  year: number;
  month: number;
  totalAmount: number;
  byCategory: { category: string; total: number; count: number }[];
}

// ===== ONBOARDING =====
export type OnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface OnboardingDocument {
  id: string;
  title: string;
  required: boolean;
  status: string;
  fileUrl?: string;
  note?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface OnboardingTask {
  id: string;
  title: string;
  status: string;
  note?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface Onboarding {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  status: OnboardingStatus;
  documents: OnboardingDocument[];
  hrTasks: OnboardingTask[];
  employeeTasks: OnboardingTask[];
  welcomeEmailSent: boolean;
  welcomeEmailSentAt?: string;
  startedAt?: string;
  completedAt?: string;
}

// ===== EXIT =====
export type ExitStatus =
  | "REQUESTED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";

export type FFSStatus = "DRAFT" | "FINALIZED" | "PAID";

export interface FFSCalculation {
  pendingSalary: number;
  leaveEncashment: number;
  bonus: number;
  deductions: number;
  totalPayable: number;
  status: FFSStatus;
  notes?: string;
  finalizedAt?: string;
  paidAt?: string;
}

export interface ExitRequest {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  status: ExitStatus;
  reason: string;
  requestedLastWorkingDay: string;
  approvedLastWorkingDay?: string;
  hrTasks: OnboardingTask[];
  employeeTasks: OnboardingTask[];
  ffsCalculation: FFSCalculation;
  experienceLetterIssuedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  requestedAt: string;
  completedAt?: string;
}

// ===== PAYROLL =====
export type PayrollRunStatus = "DRAFT" | "PROCESSED" | "LOCKED";
export type PayslipStatus = "GENERATED" | "OVERRIDDEN";
export type TDSRegime = "OLD" | "NEW";

export interface SalaryStructure {
  id: string;
  userId: string;
  basic: number;
  hra: number;
  communicationAllowance: number;
  otherAllowance: number;
  employerInsurance: number;
  professionalTax: number;
  tds: number;
  employeeInsurance: number;
  employerPF?: number | null;
  employeePF?: number | null;
  panNumber?: string;
  uanNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  tdsRegime?: TDSRegime;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  year: number;
  month: number;
  workingDays: number;
  status: PayrollRunStatus;
  generatedCount?: number;
  createdAt: string;
  processedAt?: string;
  lockedAt?: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    employeeCode?: string;
  };
  year: number;
  month: number;
  basic: number;
  hra: number;
  communicationAllowance: number;
  otherAllowance: number;
  employerPF: number;
  employerInsurance: number;
  employeePF: number;
  professionalTax: number;
  tds: number;
  employeeInsurance: number;
  panNumber?: string;
  uanNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  tdsRegime?: TDSRegime;
  workingDays: number;
  attendedDays: number;
  lopDays: number;
  lopDeduction: number;
  totalGross: number;
  totalDeductions: number;
  netPay: number;
  status: PayslipStatus;
  // Release state — whether HR has sent this payslip to the employee.
  // Unsent payslips are invisible to the employee.
  sent?: boolean;
  sentAt?: string | null;
  notes?: string;
  generatedAt: string;
}

// ===== HOLIDAY =====
export interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
}

// ===== ASSET =====
export type AssetStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "DAMAGED"
  | "LOST"
  | "RETIRED";

export type AssetReportStatus =
  | "PENDING"
  | "RESOLVED"
  | "REJECTED";

export type AssetReportType = "DAMAGE" | "LOSS" | "OTHER";

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string;
  serialNumber?: string;
  notes?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  status: AssetStatus;
  assignedToUserId?: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  assignedAt?: string;
  returnedAt?: string;
}

export interface AssetReport {
  id: string;
  assetId: string;
  asset?: Asset;
  reporterId: string;
  reporter?: {
    id: string;
    name: string;
    email: string;
  };
  reportType: AssetReportType;
  description: string;
  status: AssetReportStatus;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

// ===== LEAVE =====
export type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type HalfDayPart = "FIRST" | "SECOND";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  daysPerMonth: number;
  daysPerYear: number;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  description?: string;
  isActive: boolean;
}

export interface LeaveBalance {
  leaveTypeCode: string;
  leaveType?: LeaveType;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
  // Monthly accrual breakdown returned by /leaves/balance once the
  // backend started exposing the cron's history.
  accruedThisMonth?: number;
  accruedYTD?: number;
  monthlyAccrualHistory?: { month: number; addedDays: number }[];
}

export interface LeaveRequest {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  leaveTypeCode: string;
  leaveType?: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  halfDay?: boolean;
  halfDayPart?: HalfDayPart;
  attachmentUrl?: string;
  note?: string;
  decidedAt?: string;
  decidedBy?: string;
  createdAt: string;
}

export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  attendanceDate?: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  // Requested changes — every field optional. Older records only have
  // requestedCheckOut populated; newer ones can carry the full set.
  requestedDate?: string;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  requestedAttendanceType?: "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY";
  requestedWorkNotes?: string;
  reason: string;
  status: CorrectionStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  requestedAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  text: string;
  mentions?: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  assigneeId: string;
  createdBy: string;
  status: TaskStatus;
  priority?: TaskPriority;
  reminderIntervalMinutes?: number;
  dueDate?: string;
  attachments?: string[];
  startedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  teamName?: string;
  assigneeName?: string;
  // Enriched by the backend list/detail endpoints.
  assignee?: { id: string; name?: string; email?: string } | null;
  createdByUser?: { id: string; name?: string; email?: string } | null;
}

export const hasRole = (
  user: User | null,
  role: Role
): boolean => {
  if (!user) return false;
  return user.role === role;
};

export const isManager = (user: User | null): boolean =>
  hasRole(user, "MANAGER");

export const isCEO = (user: User | null): boolean =>
  hasRole(user, "CEO");

// Intern is a tag, not a Role — we use it to gate sensitive views (e.g.
// payroll/payslips) when the spec calls for restricted visibility.
export const isIntern = (user: User | null): boolean =>
  !!user && user.tag === "Intern";

export const hasManagerOrHrAccess = (user: User | null): boolean =>
  hasRole(user, "HR") || hasRole(user, "MANAGER");

// CEO has global read access — treat like HR for visibility purposes,
// but write-actions stay gated by `isHR` so CEO is read-only by default.
export const hasGlobalAccess = (user: User | null): boolean =>
  hasRole(user, "HR") || hasRole(user, "CEO");

// ===== ATTENDANCE EXPANSION (Phase B) =====
export type AttendanceStatus =
  | "CHECKED_IN"
  | "PRESENT"
  | "LATE"
  | "HALF_DAY"
  | "ABSENT"
  | "COMPLETED";

export interface AttendanceRecord {
  id?: string;
  userId?: string;
  date: string;
  attendanceType?: "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY";
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string | null;
  isLate?: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  workNotes?: string;
  completedTasks?: string[];
}

// ===== DEPARTMENTS (Phase A) =====
export interface Department {
  id: string;
  name: string;
  description?: string;
  headUserId?: string | null;
}

// ===== PROJECTS (Phase C) =====
export type ProjectStatus = "Active" | "OnHold" | "Completed";

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  departmentId?: string | null;
  projectManagerIds?: string[];
  memberIds?: string[];
  status: ProjectStatus;
  startDate?: string;
  endDate?: string | null;
  billable?: boolean;
}

// ===== TODOS (Phase C) =====
export type TodoStatus = "OPEN" | "DONE";
export type TodoPriority = "LOW" | "MEDIUM" | "HIGH";

export const TODO_PRIORITIES: TodoPriority[] = ["LOW", "MEDIUM", "HIGH"];

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TodoPriority;
  reminderAt?: string;
  status: TodoStatus;
  completedAt?: string | null;
  createdAt: string;
}

// ===== TIMESHEETS (Phase C) =====
export type TimesheetStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface TimesheetEntry {
  date: string;
  hours: number;
  projectId?: string | null;
  notes?: string;
  billable?: boolean;
  attendanceStatus?: AttendanceStatus;
}

export interface Timesheet {
  id: string | null;
  userId: string;
  weekStart: string;
  entries: TimesheetEntry[];
  totalHours: number;
  status: TimesheetStatus;
  draft?: boolean;
  note?: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

// ===== REIMBURSEMENTS (Phase C) =====
export type ReimbursementStatus =
  | "PENDING_MANAGER"
  | "PENDING_HR"
  | "APPROVED"
  | "REJECTED";

export type PaymentMode =
  | "Cash"
  | "Bank Transfer"
  | "UPI"
  | "Credit Card"
  | "Debit Card"
  | "Company Wallet";

export const PAYMENT_MODES: PaymentMode[] = [
  "Cash",
  "Bank Transfer",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Company Wallet",
];

export interface Reimbursement {
  id: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  title: string;
  category: string;
  expenseDate: string;
  amount: number;
  paymentMode?: PaymentMode | string;
  vendorName?: string;
  invoiceNumber?: string;
  taxAmount?: number;
  description?: string;
  attachments?: string[];
  status: ReimbursementStatus;
  decidedByManagerAt?: string;
  decidedByHrAt?: string;
  decisionNote?: string;
  createdAt: string;
}

// ===== NOTIFICATIONS (Phase B) =====
export type NotificationType =
  | "leave_decision"
  | "correction_decision"
  | "task_assigned"
  | "task_complete"
  | "reimbursement_decision"
  | "timesheet_decision"
  | "interview_scheduled"
  | "offer_response"
  | "goal_assigned"
  | "review_started"
  | "review_self_eval_submitted"
  | "review_submitted"
  | "feedback_received";

export interface NotificationItem {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
}

// ===== DASHBOARDS (Phase B) =====
export interface DashboardMe {
  todayAttendance?: AttendanceRecord & {
    attendanceType?: string;
  };
  leaveBalances: {
    code: string;
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
  }[];
  openTasksCount: number;
  recentTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
  }[];
  pendingLeaveRequests: number;
  pendingCorrectionRequests: number;
  pendingReimbursementRequests?: number;
  recentPayslips: {
    year: number;
    month: number;
    netPay: number;
    status: string;
  }[];
  unreadNotifications: number;
  // KPIs
  attendanceRatePctMTD?: number | null;
  onTimeCheckInRatePctMTD?: number | null;
  avgHoursPerDayThisWeek?: number | null;
  overtimeHoursThisMonth?: number;
  myTaskCompletionRatePct30d?: number | null;
  pendingRequestsTotal?: number;
  requiredDocCompletenessPct?: number | null;
}

export interface DashboardHR {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  pendingLeaveApprovals: number;
  pendingCorrectionApprovals: number;
  // Per-queue pending counts (for tile badges)
  pendingReimbursementApprovals?: number;
  pendingTimesheetApprovals?: number;
  pendingManualAttendanceApprovals?: number;
  pendingOnboardings?: number;
  payrollStatus?: {
    year: number;
    month: number;
    status: string;
  };
  upcomingBirthdays: {
    id: string;
    name: string;
    birthday: string;
    tag?: string;
  }[];
  employeeDistribution: {
    departmentId: string | null;
    departmentName: string;
    count: number;
  }[];
  // KPIs
  wfhToday?: number;
  officeToday?: number;
  pendingApprovalsTotal?: number;
  payCycleAccuracyPct?: number | null;
  holidayCountThisYear?: number;
  lateArrivalRatePct?: number | null;
}

export interface DashboardManager {
  directReports: number;
  teamAttendanceToday: {
    userId: string;
    status: AttendanceStatus;
    isLate?: boolean;
    checkIn?: string;
  }[];
  pendingLeaveApprovals: number;
  pendingCorrectionApprovals: number;
  // Per-queue pending counts (for tile badges)
  pendingReimbursementApprovals?: number;
  pendingTimesheetApprovals?: number;
  pendingManualAttendanceApprovals?: number;
  openTasksForReports: number;
  upcomingDeadlines: {
    id: string;
    title: string;
    assigneeId: string;
    dueDate?: string;
    priority?: TaskPriority;
  }[];
  // KPIs
  teamAttendanceRatePctMTD?: number | null;
  teamWfhRatioPctToday?: number | null;
  pendingApprovalsTotal?: number;
  onTimeTaskDeliveryPct30d?: number | null;
  teamAvgHoursPerDay7d?: number | null;
}

// ===== AUDIT LOGS (Phase A) =====
export interface AuditLog {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  at: string;
  before?: any;
  after?: any;
  metadata?: any;
}

// ===== UPLOADS (Phase E) =====
export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
  mimeType: string;
  uploadedBy?: string;
}

// ===== RECRUITMENT (Phase D) =====
export type EmploymentType =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Internship";

export type JobOpeningStatus = "Open" | "OnHold" | "Closed";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
];

export const JOB_OPENING_STATUSES: JobOpeningStatus[] = [
  "Open",
  "OnHold",
  "Closed",
];

export interface JobOpening {
  id: string;
  title: string;
  departmentId?: string | null;
  location?: string;
  employmentType?: EmploymentType;
  description?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings?: number;
  status: JobOpeningStatus;
  createdAt?: string;
}

export type CandidateStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export const CANDIDATE_STAGES: CandidateStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

export type CandidateSource =
  | "Referral"
  | "Job Portal"
  | "LinkedIn"
  | "Website"
  | "Walk-in"
  | "Agency"
  | "Other";

export const CANDIDATE_SOURCES: CandidateSource[] = [
  "Referral",
  "Job Portal",
  "LinkedIn",
  "Website",
  "Walk-in",
  "Agency",
  "Other",
];

export interface StageHistoryEntry {
  stage: CandidateStage;
  at: string;
  byUserId?: string;
  note?: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  jobOpeningId?: string;
  resumeUrl?: string;
  source?: CandidateSource;
  referredByUserId?: string;
  currentCompany?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriodDays?: number;
  notes?: string;
  stage: CandidateStage;
  stageHistory?: StageHistoryEntry[];
  createdAt?: string;
}

export type InterviewMode = "In-person" | "Phone" | "Video";

export const INTERVIEW_MODES: InterviewMode[] = [
  "In-person",
  "Phone",
  "Video",
];

export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type InterviewRecommendation =
  | "STRONG_HIRE"
  | "HIRE"
  | "NO_HIRE"
  | "STRONG_NO_HIRE";

export const INTERVIEW_RECS: InterviewRecommendation[] = [
  "STRONG_HIRE",
  "HIRE",
  "NO_HIRE",
  "STRONG_NO_HIRE",
];

export interface InterviewFeedback {
  byUserId?: string;
  rating?: number;
  recommendation?: InterviewRecommendation;
  strengths?: string;
  concerns?: string;
  notes?: string;
  submittedAt?: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  candidate?: { id: string; name: string; email: string };
  scheduledAt: string;
  durationMinutes?: number;
  mode?: InterviewMode;
  location?: string;
  interviewerIds: string[];
  round?: string;
  notes?: string;
  status: InterviewStatus;
  feedback?: InterviewFeedback[];
  createdAt?: string;
}

export type OfferStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "REVOKED";

export interface Offer {
  id: string;
  candidateId: string;
  candidate?: { id: string; name: string; email: string };
  position: string;
  annualCtc?: number;
  joiningDate?: string;
  validUntil?: string;
  notes?: string;
  salaryBreakdown?: any;
  status: OfferStatus;
  publicToken?: string;
  sentAt?: string;
  decidedAt?: string;
  createdAt?: string;
}

// ===== PERFORMANCE (Phase D) =====
export type GoalStatus =
  | "DRAFT"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export const GOAL_STATUSES: GoalStatus[] = [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

export interface GoalProgress {
  at: string;
  byUserId?: string;
  achievedValue?: number;
  note?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate?: string;
  targetValue?: number;
  unit?: string;
  weight?: number;
  status: GoalStatus;
  achievedValue?: number;
  progressHistory?: GoalProgress[];
  createdBy?: string;
  createdAt?: string;
}

export type ReviewType =
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "ANNUAL"
  | "PROMOTION"
  | "PROBATION";

export const REVIEW_TYPES: ReviewType[] = [
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "PROMOTION",
  "PROBATION",
];

export type ReviewStatus =
  | "SELF_EVAL"
  | "MANAGER_EVAL"
  | "SUBMITTED"
  | "ACKNOWLEDGED";

export interface DimensionRating {
  dimension: string;
  rating: number;
  comment?: string;
}

export interface ReviewSelfEval {
  accomplishments?: string;
  challenges?: string;
  ratings?: DimensionRating[];
  overallSelfRating?: number;
  submittedAt?: string;
}

export interface ReviewManagerEval {
  strengths?: string;
  areasToImprove?: string;
  ratings?: DimensionRating[];
  overallRating?: number;
  promotionRecommendation?: boolean;
  nextSteps?: string;
  submittedAt?: string;
}

export interface Review {
  id: string;
  employeeId: string;
  managerId?: string;
  type: ReviewType;
  periodStart: string;
  periodEnd: string;
  dimensions: string[];
  status: ReviewStatus;
  selfEval?: ReviewSelfEval;
  managerEval?: ReviewManagerEval;
  acknowledgedAt?: string;
  createdAt?: string;
}

export type FeedbackType =
  | "POSITIVE"
  | "CONSTRUCTIVE"
  | "PEER"
  | "MANAGER_TO_REPORT"
  | "REPORT_TO_MANAGER";

export const FEEDBACK_TYPES: FeedbackType[] = [
  "POSITIVE",
  "CONSTRUCTIVE",
  "PEER",
  "MANAGER_TO_REPORT",
  "REPORT_TO_MANAGER",
];

export interface FeedbackItem {
  id: string;
  fromUserId?: string | null;
  toUserId: string;
  type: FeedbackType;
  text: string;
  anonymous?: boolean;
  createdAt: string;
}

// ===== DOCUMENTS (Phase C) =====
export interface EmployeeDocument {
  id: string;
  userId?: string;
  category: string;
  fileName: string;
  fileUrl: string;
  notes?: string;
  expiresOn?: string;
  uploadedBy?: string;
  uploadedByRole?: "HR" | "USER";
  lockedByHR?: boolean;
  uploadedAt?: string;
}

// ===== REPORTS (Phase C) =====
export interface AttendanceReportRow {
  userId: string;
  userName?: string;
  totalDays: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  leaveDays: number;
  totalHours: number;
  overtimeHours: number;
}

export interface LeaveReportRow {
  userId: string;
  userName?: string;
  balances: {
    code: string;
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
  }[];
}

export interface DeptHeadcountRow {
  departmentId: string | null;
  departmentName: string;
  count: number;
}

export interface AttritionRow {
  userId: string;
  userName?: string;
  lastWorkingDay: string;
  reason?: string;
}

export interface TeamProductivityRow {
  userId: string;
  userName?: string;
  openTasks: number;
  completedTasksLast30d: number;
  avgHoursPerDayLast7d: number;
}
