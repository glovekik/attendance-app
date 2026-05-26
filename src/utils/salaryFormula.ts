// Standard salary breakdown from a monthly CTC, per company policy:
//   Basic                  = 50% of remaining CTC
//   HRA                    = 20% of remaining CTC (= 40% of Basic)
//   Communication          = 5%  of remaining CTC
//   Other Allowance        = 19% of remaining CTC (balancing component)
//   Employer PF            = 6%  of remaining CTC, capped at ₹1,800 / month
//
// "Remaining CTC" is the input monthly CTC. Components add to 100%.
// PF cap of ₹1800 is the statutory EPF ceiling (12% of ₹15,000 basic).
// When PF is capped, the saved amount is the cap and the leftover rupees
// roll into Other Allowance so the breakdown still sums to CTC.

export const PF_MONTHLY_CAP = 1800;

export interface SalaryBreakdown {
  basic: number;
  hra: number;
  communicationAllowance: number;
  otherAllowance: number;
  employerPF: number;
}

export function breakdownFromCTC(monthlyCTC: number): SalaryBreakdown {
  if (!Number.isFinite(monthlyCTC) || monthlyCTC <= 0) {
    return {
      basic: 0,
      hra: 0,
      communicationAllowance: 0,
      otherAllowance: 0,
      employerPF: 0,
    };
  }
  const basic = Math.round(monthlyCTC * 0.5);
  const hra = Math.round(monthlyCTC * 0.2);
  const communicationAllowance = Math.round(monthlyCTC * 0.05);
  const rawEmployerPF = Math.round(monthlyCTC * 0.06);
  const employerPF = Math.min(rawEmployerPF, PF_MONTHLY_CAP);
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
