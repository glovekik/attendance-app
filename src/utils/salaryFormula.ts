// Standard salary breakdown from a monthly CTC, per company policy.
//
// The split depends on whether the employee is provided company
// accommodation, because HRA (House Rent Allowance) only makes sense for
// someone paying rent. When accommodation is provided, HRA is dropped and
// its share moves into Other Allowance, so the total is unchanged either way.
//
//                        no accommodation   accommodation provided
//   Basic                     50%                   50%
//   HRA                       20%                    0%
//   Communication              5%                    5%
//   Other Allowance           19%                   39%   <- absorbs the HRA
//   Employer PF                6%                    6%
//                            ----                  ----
//                            100%                  100%
//
// "Remaining CTC" is the input monthly CTC. Other Allowance is computed as
// the balancing component (CTC minus everything else) rather than a literal
// percentage, so rounding never makes the parts miss the total.
//
// PF cap of ₹1800 is the statutory EPF ceiling (12% of ₹15,000 basic).
// When PF is capped, the saved amount is the cap and the leftover rupees
// roll into Other Allowance so the breakdown still sums to CTC.

export const PF_MONTHLY_CAP = 1800;

/** Percentage of monthly CTC each component takes, by accommodation. */
export const SALARY_PCT = {
  withoutAccommodation: { basic: 0.5, hra: 0.2, communication: 0.05, pf: 0.06 },
  withAccommodation: { basic: 0.5, hra: 0, communication: 0.05, pf: 0.06 },
} as const;

export interface SalaryBreakdown {
  basic: number;
  hra: number;
  communicationAllowance: number;
  otherAllowance: number;
  employerPF: number;
}

export function breakdownFromCTC(
  monthlyCTC: number,
  /** True when the company provides accommodation — drops HRA to zero. */
  accommodation: boolean = false
): SalaryBreakdown {
  if (!Number.isFinite(monthlyCTC) || monthlyCTC <= 0) {
    return {
      basic: 0,
      hra: 0,
      communicationAllowance: 0,
      otherAllowance: 0,
      employerPF: 0,
    };
  }
  const pct = accommodation
    ? SALARY_PCT.withAccommodation
    : SALARY_PCT.withoutAccommodation;

  const basic = Math.round(monthlyCTC * pct.basic);
  const hra = Math.round(monthlyCTC * pct.hra);
  const communicationAllowance = Math.round(monthlyCTC * pct.communication);
  const rawEmployerPF = Math.round(monthlyCTC * pct.pf);
  const employerPF = Math.min(rawEmployerPF, PF_MONTHLY_CAP);
  // Balancing component: 19% without accommodation, 39% with it, plus any
  // rupees freed by the PF cap.
  const otherAllowance =
    monthlyCTC - basic - hra - communicationAllowance - employerPF;
  return {
    basic,
    hra,
    communicationAllowance,
    otherAllowance: Math.max(0, otherAllowance),
    employerPF,
  };
}
