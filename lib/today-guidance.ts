export type ConsumerTone = "supportive" | "balanced" | "sensitive" | "quiet";

export type PredictionResultInput = {
  domain: string;
  outlook: string;
  strength: string;
  net_score: number;
  statement: string;
  advisory: string;
  favourable_timing: string | null;
  challenging_timing: string | null;
  supporting_factors: unknown[];
  challenging_factors: unknown[];
  contextual_factors: unknown[];
};

export type ProviderReadingInput = {
  results: PredictionResultInput[];
};

export type TodayAreaGuidance = {
  key: "work" | "money" | "relationships" | "wellbeing";
  label: string;
  icon: string;
  status: string;
  note: string;
  tone: ConsumerTone;
};

export type ProviderTodayGuidance = {
  headline: string;
  summary: string;
  action: string;
  signalLabel: string;
  patternLabel: string;
  tone: ConsumerTone;
  sourceDomain: string | null;
  supportiveWindow: string | null;
  sensitiveWindow: string | null;
  areas: TodayAreaGuidance[];
};

const domainTitles: Record<string, string> = {
  overall: "Overall",
  career: "Career & work",
  money_resources: "Money & resources",
  relationships_marriage: "Relationships",
  family_home: "Family & home",
  education_creativity: "Learning & creativity",
  wellbeing: "Wellbeing",
  travel_change: "Travel & change",
  spirituality: "Inner balance",
};

const domainPriority: Record<string, number> = {
  overall: 9,
  career: 8,
  relationships_marriage: 7,
  money_resources: 6,
  wellbeing: 5,
  family_home: 4,
  education_creativity: 3,
  travel_change: 2,
  spirituality: 1,
};

const areaDefinitions = [
  {
    key: "work" as const,
    label: "Work",
    icon: "briefcase",
    domains: ["career", "education_creativity", "overall"],
  },
  {
    key: "money" as const,
    label: "Money",
    icon: "money",
    domains: ["money_resources", "overall"],
  },
  {
    key: "relationships" as const,
    label: "Relationships",
    icon: "heart",
    domains: ["relationships_marriage", "family_home", "overall"],
  },
  {
    key: "wellbeing" as const,
    label: "Wellbeing",
    icon: "activity",
    domains: ["wellbeing", "spirituality", "overall"],
  },
];

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isUsefulText(value: string | null | undefined): value is string {
  const text = value?.trim() ?? "";
  if (!text) return false;
  return !/(insufficient evidence|not enough directional evidence|not sufficient for|no directional evidence)/i.test(
    text,
  );
}

function evidenceCount(result: PredictionResultInput): number {
  return (
    result.supporting_factors.length +
    result.challenging_factors.length +
    result.contextual_factors.length
  );
}

function strengthRank(strength: string): number {
  const value = normalized(strength);
  if (value.includes("strong") || value.includes("high")) return 3;
  if (value.includes("moderate") || value.includes("medium")) return 2;
  if (value.includes("light") || value.includes("low") || value.includes("weak")) return 1;
  return 1;
}

export function isInsufficientOutlook(outlook: string): boolean {
  const value = normalized(outlook);
  return value === "insufficient" || value === "insufficient_evidence";
}

export function consumerTone(result: PredictionResultInput): ConsumerTone {
  if (isInsufficientOutlook(result.outlook)) return "quiet";
  if (normalized(result.outlook) === "favourable") return "supportive";
  if (normalized(result.outlook) === "challenging") return "sensitive";
  return "balanced";
}

export function consumerSignalLabel(result: PredictionResultInput): string {
  const tone = consumerTone(result);
  if (tone === "supportive") return "Supportive";
  if (tone === "sensitive") return "Sensitive";
  if (tone === "balanced") return "Mixed";
  return "Quiet";
}

export function consumerPatternLabel(result: PredictionResultInput): string {
  if (consumerTone(result) === "quiet") return "Light pattern";
  if (consumerTone(result) === "balanced") return "Mixed pattern";
  const rank = strengthRank(result.strength);
  if (rank >= 3) return "Strong pattern";
  if (rank >= 2) return "Clear pattern";
  return "Light pattern";
}

export function consumerDomainTitle(domain: string): string {
  return domainTitles[domain] ?? domain.replaceAll("_", " ");
}

function fallbackSummary(tone: ConsumerTone): string {
  if (tone === "supportive") {
    return "The available signals lean supportive. Use the momentum while keeping normal practical checks in place.";
  }
  if (tone === "sensitive") {
    return "The available signals favour a slower, more deliberate approach today.";
  }
  if (tone === "balanced") {
    return "Supportive and challenging factors are both present. Move steadily and stay flexible.";
  }
  return "The chart shows a lighter directional pattern today. Keep plans simple and use your usual judgment.";
}

export function consumerResultSummary(result: PredictionResultInput): string {
  if (isUsefulText(result.statement)) return result.statement.trim();
  return fallbackSummary(consumerTone(result));
}

function fallbackAction(result: PredictionResultInput): string {
  const tone = consumerTone(result);
  const domain = result.domain;

  if (tone === "sensitive") {
    return "Pause before reacting and protect extra time for review.";
  }
  if (tone === "balanced") {
    return "Take one measured step, then reassess before committing further.";
  }
  if (tone === "quiet") {
    return "Keep one clear priority and notice which themes repeat through the day.";
  }
  if (domain === "relationships_marriage" || domain === "family_home") {
    return "Use the supportive tone for one calm, honest conversation.";
  }
  if (domain === "money_resources") {
    return "Review one practical money decision and favour steady progress over impulse.";
  }
  if (domain === "wellbeing") {
    return "Protect one routine that supports your energy and recovery.";
  }
  return "Choose one important task and move it forward with focused effort.";
}

export function consumerAction(result: PredictionResultInput): string {
  if (isUsefulText(result.advisory)) return result.advisory.trim();
  return fallbackAction(result);
}

function headlineFor(result: PredictionResultInput): string {
  const tone = consumerTone(result);
  if (tone === "sensitive") return "Slow the pace and protect your judgment.";
  if (tone === "balanced") return "Move forward, but leave room to adjust.";
  if (tone === "quiet") return "Keep today simple and notice what repeats.";

  if (result.domain === "career" || result.domain === "education_creativity") {
    return "Build momentum through focused work.";
  }
  if (result.domain === "relationships_marriage" || result.domain === "family_home") {
    return "Lead with warmth and clear communication.";
  }
  if (result.domain === "money_resources") {
    return "Steady planning can support your resources.";
  }
  if (result.domain === "wellbeing" || result.domain === "spirituality") {
    return "Protect the habits that support your balance.";
  }
  return "Use today’s supportive pattern with intention.";
}

function resultScore(result: PredictionResultInput): number {
  const useful = isInsufficientOutlook(result.outlook) ? 0 : 1;
  const magnitude = Math.min(99, Math.round(Math.abs(result.net_score) * 100));
  return (
    useful * 10000 +
    strengthRank(result.strength) * 1000 +
    evidenceCount(result) * 100 +
    magnitude +
    (domainPriority[result.domain] ?? 0)
  );
}

function primaryResult(results: PredictionResultInput[]): PredictionResultInput | null {
  return [...results].sort((left, right) => resultScore(right) - resultScore(left))[0] ?? null;
}

function firstUsefulTiming(
  results: PredictionResultInput[],
  field: "favourable_timing" | "challenging_timing",
): string | null {
  for (const result of results) {
    const value = result[field];
    if (isUsefulText(value)) return value.trim();
  }
  return null;
}

function areaGuidance(
  results: PredictionResultInput[],
  definition: (typeof areaDefinitions)[number],
): TodayAreaGuidance {
  const result = definition.domains
    .map((domain) => results.find((item) => item.domain === domain))
    .find((item): item is PredictionResultInput => Boolean(item));

  if (!result) {
    return {
      key: definition.key,
      label: definition.label,
      icon: definition.icon,
      status: "Quiet",
      note: "No strong directional pattern; use your normal judgment.",
      tone: "quiet",
    };
  }

  return {
    key: definition.key,
    label: definition.label,
    icon: definition.icon,
    status: consumerSignalLabel(result),
    note: consumerAction(result),
    tone: consumerTone(result),
  };
}

export function buildProviderTodayGuidance(reading: ProviderReadingInput): ProviderTodayGuidance {
  const primary = primaryResult(reading.results);
  const ordered = primary
    ? [primary, ...reading.results.filter((result) => result !== primary)]
    : reading.results;

  if (!primary) {
    return {
      headline: "Keep today simple and intentional.",
      summary: "Your calculated reading is available, but no life-area result was returned.",
      action: "Choose one practical priority and use your normal judgment.",
      signalLabel: "Quiet",
      patternLabel: "Light pattern",
      tone: "quiet",
      sourceDomain: null,
      supportiveWindow: null,
      sensitiveWindow: null,
      areas: areaDefinitions.map((definition) => areaGuidance([], definition)),
    };
  }

  return {
    headline: headlineFor(primary),
    summary: consumerResultSummary(primary),
    action: consumerAction(primary),
    signalLabel: consumerSignalLabel(primary),
    patternLabel: consumerPatternLabel(primary),
    tone: consumerTone(primary),
    sourceDomain: primary.domain,
    supportiveWindow: firstUsefulTiming(ordered, "favourable_timing"),
    sensitiveWindow: firstUsefulTiming(ordered, "challenging_timing"),
    areas: areaDefinitions.map((definition) => areaGuidance(reading.results, definition)),
  };
}
