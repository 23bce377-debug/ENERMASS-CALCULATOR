const rates = {
  GI: { Appolo: 120, Tata: 110 },
  GP: { Appolo: 100, Deemac: 90 }
};

const templates = {
  "3KW": {
    panels: 6,
    weights: {
      GI: {
        Appolo: { rafter: 10, purlin: 8 },
        Tata: { rafter: 12, purlin: 9 }
      },
      GP: {
        Appolo: { rafter: 7, purlin: 5 },
        Deemac: { rafter: 6, purlin: 4 }
      }
    },
    bom: {
      GP: {
        rafter_qty: 2,
        purlin_qty: 2.5,
        accessories: {
          "MS Hole Plate 4x4": { qty: 5, rate: 120, weight: 1.75 },
          "Anchor Bolt 8mm": { qty: 8, rate: 10, weight: 8 },
          "PVC End Cap 3x1.5": { qty: 4, rate: 4, weight: 4 },
          "PVC End Cap 1.5x1.5": { qty: 10, rate: 4, weight: 10 },
          "Epoxy Primer": { qty: 0.5, rate: 380, weight: 0.5 },
          "Thinner": { qty: 0.5, rate: 140, weight: 0.5 },
          "Roller Brush": { qty: 1, rate: 100, weight: 1 },
          "Solid Block": { qty: 4, rate: 120, weight: 4 },
          "Nano Grout": { qty: 1, rate: 350, weight: 1 },
          "Welding Rod": { qty: 40, rate: 3, weight: 40 },
          "Cutting Wheel": { qty: 4, rate: 15, weight: 4 }
        }
      },
      GI: {
        rafter_qty: 2,
        purlin_qty: 2.5,
        accessories: {
          "MS Hole Plate 4x4": { qty: 5, rate: 120, weight: 2.45 },
          "Anchor Bolt 8mm": { qty: 8, rate: 10, weight: 12 },
          "PVC End Cap 3x1.5": { qty: 4, rate: 4, weight: 6 },
          "PVC End Cap 1.5x1.5": { qty: 10, rate: 4, weight: 12 },
          "Epoxy Primer": { qty: 0.5, rate: 380, weight: 0.5 },
          "Thinner": { qty: 0.5, rate: 140, weight: 0.5 },
          "Roller Brush": { qty: 1, rate: 100, weight: 1 },
          "Solid Block": { qty: 4, rate: 120, weight: 4 },
          "Nano Grout": { qty: 1, rate: 350, weight: 1 },
          "Welding Rod": { qty: 40, rate: 3, weight: 40 },
          "Cutting Wheel": { qty: 4, rate: 15, weight: 4 }
        }
      }
    }
  },
  "5KW": {
    panels: 9,
    weights: {
      GI: {
        Appolo: { rafter: 45, purlin: 76 },
        Tata: { rafter: 20, purlin: 22 }
      },
      GP: {
        Appolo: { rafter: 10, purlin: 34 },
        Deemac: { rafter: 5, purlin: 8 }
      }
    },
    bom: {
      GP: {
        rafter_qty: 3,
        purlin_qty: 4,
        accessories: {
          "MS Hole Plate 4x4": { qty: 7, rate: 120, weight: 2.45 },
          "Anchor Bolt 8mm": { qty: 12, rate: 10, weight: 12 },
          "PVC End Cap 3x1.5": { qty: 6, rate: 4, weight: 6 },
          "PVC End Cap 1.5x1.5": { qty: 12, rate: 4, weight: 12 },
          "Epoxy Primer": { qty: 0.5, rate: 380, weight: 0.5 },
          "Thinner": { qty: 0.5, rate: 140, weight: 0.5 },
          "Roller Brush": { qty: 1, rate: 100, weight: 1 },
          "Solid Block": { qty: 4, rate: 120, weight: 4 },
          "Nano Grout": { qty: 1, rate: 350, weight: 1 },
          "Welding Rod": { qty: 60, rate: 3, weight: 60 },
          "Cutting Wheel": { qty: 6, rate: 15, weight: 6 }
        }
      },
      GI: {
        rafter_qty: 3,
        purlin_qty: 4,
        accessories: {
          "MS Hole Plate 4x4": { qty: 7, rate: 120, weight: 3.43 },
          "Anchor Bolt 8mm": { qty: 12, rate: 10, weight: 18 },
          "PVC End Cap 3x1.5": { qty: 6, rate: 4, weight: 9 },
          "PVC End Cap 1.5x1.5": { qty: 12, rate: 4, weight: 18 },
          "Epoxy Primer": { qty: 0.5, rate: 380, weight: 0.5 },
          "Thinner": { qty: 0.5, rate: 140, weight: 0.5 },
          "Roller Brush": { qty: 1, rate: 100, weight: 1 },
          "Solid Block": { qty: 4, rate: 120, weight: 4 },
          "Nano Grout": { qty: 1, rate: 350, weight: 1 },
          "Welding Rod": { qty: 60, rate: 3, weight: 60 },
          "Cutting Wheel": { qty: 6, rate: 15, weight: 6 }
        }
      }
    }
  }
};

function calculate(kw, type, vendor, assumption) {
  const t = templates[kw];
  if (!t) return null;
  const w = t.weights[type][vendor];
  const b = t.bom[type];
  const r = rates[type][vendor];

  let metalCost = 0;
  if (assumption === 'total') {
    metalCost = (w.rafter + w.purlin) * r;
  } else {
    metalCost = (b.rafter_qty * w.rafter + b.purlin_qty * w.purlin) * r;
  }

  let accessoriesCost = 0;
  for (const [name, item] of Object.entries(b.accessories)) {
    let cost = 0;
    if (name === "MS Hole Plate 4x4" || name === "Epoxy Primer" || name === "Thinner" || name === "Welding Rod") {
      cost = item.weight * item.rate;
    } else {
      cost = item.qty * item.rate;
    }
    accessoriesCost += cost;
  }
  return { metalCost, accessoriesCost, total: metalCost + accessoriesCost };
}

console.log("Hypothesis 1: Weight is total weight");
console.log("3KW GP Deemac:", calculate("3KW", "GP", "Deemac", "total"));
console.log("3KW GP Appolo:", calculate("3KW", "GP", "Appolo", "total"));

console.log("\nHypothesis 2: Weight is per member weight");
console.log("3KW GP Deemac:", calculate("3KW", "GP", "Deemac", "member"));
console.log("3KW GP Appolo:", calculate("3KW", "GP", "Appolo", "member"));
