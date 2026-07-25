import {
  buildProviderTodayGuidance,
  consumerPatternLabel,
  consumerSignalLabel,
  type PredictionResultInput,
} from "../../../lib/today-guidance.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function result(overrides: Partial<PredictionResultInput> = {}): PredictionResultInput {
  return {
    domain: "overall",
    outlook: "mixed",
    strength: "moderate",
    net_score: 0,
    statement: "Supporting and challenging factors are both present.",
    advisory: "Move steadily and review before committing.",
    favourable_timing: null,
    challenging_timing: null,
    supporting_factors: [{}],
    challenging_factors: [{}],
    contextual_factors: [],
    ...overrides,
  };
}

Deno.test("Today guidance chooses the strongest useful life-area result", () => {
  const guidance = buildProviderTodayGuidance({
    results: [
      result({
        domain: "career",
        outlook: "insufficient_evidence",
        strength: "low",
        statement: "There is insufficient evidence for a conclusion.",
        advisory: "Use normal judgment.",
        supporting_factors: [],
        challenging_factors: [],
      }),
      result({
        domain: "money_resources",
        outlook: "favourable",
        strength: "strong",
        net_score: 0.72,
        statement: "Planning and restraint support steady resource decisions.",
        advisory: "Review one practical money decision before acting.",
        favourable_timing: "A supportive planning window appears in the late morning.",
        supporting_factors: [{}, {}, {}],
        challenging_factors: [],
      }),
    ],
  });

  assert(guidance.sourceDomain === "money_resources", "Expected money to be the primary signal.");
  assert(guidance.signalLabel === "Supportive", "Expected a supportive consumer label.");
  assert(guidance.patternLabel === "Strong pattern", "Expected a strong pattern label.");
  assert(guidance.supportiveWindow?.includes("late morning"), "Expected supportive timing.");
});

Deno.test("Today guidance never makes insufficient evidence the main message", () => {
  const guidance = buildProviderTodayGuidance({
    results: [
      result({
        domain: "overall",
        outlook: "insufficient",
        strength: "low",
        statement: "There is not enough directional evidence for a conclusion.",
        advisory: "Insufficient evidence is available.",
        supporting_factors: [],
        challenging_factors: [],
        contextual_factors: [{}],
      }),
    ],
  });

  const consumerCopy = `${guidance.headline} ${guidance.summary} ${guidance.action}`.toLowerCase();
  assert(!consumerCopy.includes("insufficient"), "Consumer guidance exposed insufficient language.");
  assert(!consumerCopy.includes("not enough"), "Consumer guidance exposed not-enough language.");
  assert(guidance.signalLabel === "Quiet", "Expected a quiet label for a light pattern.");
  assert(guidance.patternLabel === "Light pattern", "Expected a light pattern label.");
});

Deno.test("Today guidance builds four practical life-area summaries", () => {
  const guidance = buildProviderTodayGuidance({
    results: [
      result({ domain: "career", outlook: "favourable", advisory: "Finish one priority." }),
      result({ domain: "money_resources", outlook: "mixed", advisory: "Review spending." }),
      result({
        domain: "relationships_marriage",
        outlook: "challenging",
        advisory: "Pause before reacting.",
      }),
      result({ domain: "wellbeing", outlook: "insufficient_evidence", advisory: "Protect rest." }),
    ],
  });

  assert(guidance.areas.length === 4, "Expected four life-area summaries.");
  assert(guidance.areas.find((area) => area.key === "work")?.status === "Supportive", "Work label mismatch.");
  assert(guidance.areas.find((area) => area.key === "money")?.status === "Mixed", "Money label mismatch.");
  assert(
    guidance.areas.find((area) => area.key === "relationships")?.status === "Sensitive",
    "Relationship label mismatch.",
  );
  assert(guidance.areas.find((area) => area.key === "wellbeing")?.status === "Quiet", "Wellbeing label mismatch.");
});

Deno.test("Consumer labels remain calm and non-technical", () => {
  const mixed = result({ outlook: "mixed", strength: "moderate" });
  const quiet = result({ outlook: "insufficient_evidence", strength: "low" });

  assert(consumerSignalLabel(mixed) === "Mixed", "Mixed signal label changed.");
  assert(consumerPatternLabel(mixed) === "Mixed pattern", "Mixed pattern label changed.");
  assert(consumerSignalLabel(quiet) === "Quiet", "Quiet signal label changed.");
  assert(consumerPatternLabel(quiet) === "Light pattern", "Light pattern label changed.");
});
