/** Stable merchant identity for bank descriptions; preserve the original text on the row. */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(
      /^(?:card payment to|card payment|visa debit|direct debit|dd\s+|revolut\s*[-:]\s*|lloyds\s*[-:]\s*|hsbc\s*[-:]\s*)+/g,
      "",
    )
    .replace(/\b(?:on|at)\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/g, "")
    .replace(/\b(?:ref|reference|auth|card ending)[:\s#-]*[a-z0-9-]{4,}\b/g, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\b(?:stores?|express|superstore)\b/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const known: [RegExp, string][] = [
  [
    /\btesco\b|\bsainsburys\b|\baldi\b|\blidl\b|\basda\b|\bmorrisons\b/,
    "Groceries",
  ],
  [/\btfl\b|transport for london|\bnational rail\b|\btrainline\b/, "Transport"],
  [/\bnetflix\b|\bspotify\b|\bdisney plus\b/, "Subscriptions"],
  [/\bpret a manger\b|\bcosta coffee\b|\bstarbucks\b/, "Eating out"],
];

export function knownMerchantCategory(description: string): string | null {
  const key = merchantKey(description);
  return known.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}
