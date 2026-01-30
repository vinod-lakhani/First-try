/**
 * Net Worth Impact tool – types
 * Delta-to-net-worth translator: one monthly change → future impact.
 */

export type UseCase = "investing" | "cash" | "debt";

export interface ImpactInputs {
  monthlyDelta: number; // can be negative ($/mo)
  useCase: UseCase;
  realReturn?: number; // default 0.05 (5% real) for investing
  debtApr?: number; // default 0.18 for debt payoff
}

export interface HorizonImpact {
  years: number;
  impact: number; // currency dollars, can be negative
}
