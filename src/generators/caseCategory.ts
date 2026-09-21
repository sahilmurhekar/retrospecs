// The category a generated value belongs to — describes *why* this
// particular value was generated, which determines what response we
// should expect from the server.
export type CaseCategory =
  | "valid"          // a normal, in-range value — should succeed
  | "boundary-low"   // exactly at or just below the minimum — may be valid or invalid depending on inclusivity
  | "boundary-high"  // exactly at or just above the maximum — same idea
  | "zero"           // the deliberate "0" case — often a special edge case
  | "missing";        // the param was omitted entirely — reserved for later use

// A single generated value, tagged with the category it belongs to.
export type GeneratedValue<T = unknown> = {
  value: T;
  category: CaseCategory;
};

// Which categories are expected to succeed (return a 2xx) vs.
// be rejected (return a 4xx) by a well-behaved API.
// This is deliberately simple for now — a starting assumption we can
// refine later per-endpoint if needed.
export function expectedOutcomeFor(category: CaseCategory): "success" | "rejection" {
  switch (category) {
    case "valid":
      return "success";
    case "boundary-low":
    case "boundary-high":
    case "missing":
      return "rejection";
    case "zero":
      // zero is ambiguous — could be valid or invalid depending on the field,
      // so for now we don't assume either way (validator will handle this specially)
      return "rejection";
  }
}