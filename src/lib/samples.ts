// Dummy documents from Samjho AI's demo. All names and numbers are made up.
export const SAMPLES = {
  rent: {
    income: 40000,
    emi: 0,
    text: `RENT AGREEMENT
This agreement is between landlord Mr. Sharma (PAN ABCDE1234F, phone 9876543210) and tenant Mr. Verma (Aadhaar 1234 5678 9012).
The monthly rent shall be Rs. 18,000, payable by the 5th of each month.
The tenant shall pay a security deposit of Rs. 90,000.
There is a lock-in period of 11 months.
The landlord may increase the rent at his discretion every year.`,
  },
  loan: {
    income: 40000,
    emi: 5000,
    text: `PERSONAL LOAN SANCTION LETTER
The lender sanctions a loan to the borrower with an EMI of Rs. 22,000 per month.
The interest rate is floating and may reset every quarter.
A processing fee of Rs. 5,000 is charged at disbursal.
Prepayment charges of 4% apply if the loan is closed within 3 years.
Borrower account no. 123456789012, email ravi@example.com.`,
  },
  insurance: {
    income: 50000,
    emi: 0,
    text: `TERM LIFE INSURANCE POLICY
The insured is covered under this policy. Sum assured is Rs. 5,00,000. The premium is payable yearly.
The nominee will receive the sum assured on a valid claim.
A waiting period of 2 years applies to some conditions.
Exclusions: death by suicide in the first year and other cases listed in Schedule B.`,
  },
} as const;
export type SampleKey = keyof typeof SAMPLES;
