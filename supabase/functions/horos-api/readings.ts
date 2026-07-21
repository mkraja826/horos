import type { Period } from "./types.ts";

const sharedSections = {
  energy: {
    key: "energy",
    title: "Overall focus",
    icon: "sun",
    content: "Move through responsibilities one at a time and leave room to review important details.",
    premium: false,
  },
  family: {
    key: "family",
    title: "Family life",
    icon: "family",
    content: "A calm conversation and clear division of responsibilities can reduce avoidable pressure.",
    premium: true,
  },
  work: {
    key: "career",
    title: "Career & work",
    icon: "briefcase",
    content: "Prioritise preparation, realistic deadlines and written follow-up before making commitments.",
    premium: true,
  },
  health: {
    key: "health",
    title: "Health routine",
    icon: "activity",
    content: "Keep sleep, meals and gentle movement regular. Seek qualified care for any health concern.",
    premium: true,
  },
};

export function generateEditorialReading(period: Period) {
  const generatedAt = new Date().toISOString();
  const base = {
    generatedAt,
    calculationMode: "editorial" as const,
    remedy: "Take two quiet minutes before an important conversation or decision.",
  };

  if (period === "daily") {
    return {
      ...base,
      period,
      label: "Today’s practical guidance",
      focus: "Clarity, patience and one well-finished task",
      summary:
        "This is general wellbeing guidance, not a planetary prediction. Use it as a calm planning prompt for the day.",
      sections: [sharedSections.energy, sharedSections.family, sharedSections.work, sharedSections.health],
    };
  }

  if (period === "weekly") {
    return {
      ...base,
      period,
      label: "This week’s practical guidance",
      focus: "Steady routines and clear communication",
      summary:
        "This editorial overview is not derived from transits. Review priorities, protect rest and communicate plans early.",
      sections: [sharedSections.energy, sharedSections.family, sharedSections.work, sharedSections.health],
    };
  }

  return {
    ...base,
    period,
    label: "This month’s practical guidance",
    focus: "Strengthening sustainable routines",
    summary:
      "This editorial overview is not a prediction. Use it to review recurring commitments, finances, rest and family time.",
    sections: [sharedSections.energy, sharedSections.family, sharedSections.work, sharedSections.health],
  };
}
