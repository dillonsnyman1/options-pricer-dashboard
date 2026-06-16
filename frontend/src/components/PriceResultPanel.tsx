import type { PriceResponse } from "../types/options";

const fmt = (n: number, dp = 4) => n.toFixed(dp);

interface Props {
  result: PriceResponse;
}

export function PriceResultPanel({ result }: Props) {
  const { bs, mc, binomial } = result;

  const cards = [
    {
      label: "Black-Scholes Price",
      value: `$${fmt(bs.price)}`,
      sub: "Analytical closed-form",
      accent: "#2563eb",
    },
    {
      label: "Monte Carlo Price",
      value: `$${fmt(mc.price)}`,
      sub: `±${fmt(mc.std_error)} std err · ${(mc.n_paths / 1000).toFixed(0)}k paths w/ antithetic variates`,
      accent: "#7c3aed",
    },
    {
      label: "Binomial (European)",
      value: `$${fmt(binomial.european_price)}`,
      sub: `${binomial.n_steps}-step CRR tree`,
      accent: "#0891b2",
    },
    {
      label: "Binomial (American)",
      value: `$${fmt(binomial.american_price)}`,
      sub: `Early exercise premium: $${fmt(binomial.early_exercise_premium)}`,
      accent: "#059669",
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((card) => (
        <div className="summary-card" key={card.label} style={{ borderTopColor: card.accent }}>
          <div className="summary-card-label">{card.label}</div>
          <div className="summary-card-value">{card.value}</div>
          <div className="summary-card-subvalue">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
