import type { Bindings, ChartResult, ProfileRow } from "./types";

type BirthInput = {
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  timezone: string;
  latitude?: number | null;
  longitude?: number | null;
};

const rashis = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"];
const nakshatras = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

function seedFrom(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return Math.abs(seed);
}

function localChart(input: BirthInput): ChartResult {
  const seed = seedFrom(`${input.dateOfBirth}|${input.timeOfBirth}|${input.birthPlace}`);
  const rashiIndex = seed % rashis.length;
  const nakshatraIndex = seed % nakshatras.length;
  const lagnaIndex = Math.floor(seed / 13) % rashis.length;
  const elements = ["Fire", "Earth", "Air", "Water"];
  return {
    rashi: rashis[rashiIndex],
    nakshatra: nakshatras[nakshatraIndex],
    lagna: rashis[lagnaIndex],
    birthStar: `${nakshatras[nakshatraIndex]} – ${(seed % 4) + 1}${["st", "nd", "rd", "th"][Math.min(seed % 4, 3)]} Pada`,
    element: elements[rashiIndex % 4],
    nature: ["Steady and caring", "Thoughtful and adaptable", "Warm and responsible", "Observant and practical"][seed % 4],
    strengths: ["Patient decision-making", "Care for family responsibilities", "Ability to learn from experience"],
    challenges: ["Carrying concerns silently", "Taking on more responsibility than necessary"],
    lifestyleBalance: "Keep dependable routines while allowing room for rest, help from others and changing family plans.",
    dasha: "Provider required for verified Vimshottari dasha",
    calculationMode: "estimated"
  };
}

async function providerRequest<T>(env: Bindings, path: string, body: Record<string, unknown>) {
  if (!env.ASTROLOGY_PROVIDER_URL || !env.ASTROLOGY_PROVIDER_KEY) return null;
  const response = await fetch(`${env.ASTROLOGY_PROVIDER_URL.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.ASTROLOGY_PROVIDER_KEY}`
    },
    body: JSON.stringify({
      ...body,
      zodiac: "sidereal",
      ayanamsa: "lahiri"
    })
  });
  if (!response.ok) throw new Error(`Astrology provider returned ${response.status}.`);
  return (await response.json()) as T;
}

export async function calculateChart(env: Bindings, input: BirthInput): Promise<ChartResult> {
  const provider = await providerRequest<Omit<ChartResult, "calculationMode">>(env, "/birth-chart", input);
  if (provider) return { ...provider, calculationMode: "provider" };
  if (env.ENVIRONMENT === "production") {
    throw new Error("A Lahiri sidereal astrology provider must be configured in production.");
  }
  return localChart(input);
}

function variant(profile: ProfileRow, period: string) {
  return seedFrom(`${profile.id}|${period}|${new Date().toISOString().slice(0, 10)}`) % 3;
}

export function generateReading(profile: ProfileRow, period: "daily" | "weekly" | "monthly") {
  const choice = variant(profile, period);
  const generatedAt = new Date().toISOString();
  const base = {
    generatedAt,
    calculationMode: profile.calculation_mode,
    luckyColor: ["Soft saffron", "Deep blue", "Leaf green"][choice],
    luckyColorHex: ["#D98B43", "#314D7D", "#638266"][choice],
    luckyNumber: [6, 3, 8][choice]
  };

  if (period === "daily") {
    return {
      ...base,
      period,
      label: "Today’s guidance",
      focus: ["Patient family conversations", "Complete one responsibility well", "A steady and generous pace"][choice],
      summary: `Today supports ${profile.rashi} natives in approaching family and work responsibilities with patience. Listen fully before responding and give practical details a second look.`,
      mantra: "Om Namah Shivaya",
      remedy: "Light a small diya in the morning and sit quietly for two minutes before beginning important work.",
      auspiciousTime: ["10:24 AM – 11:38 AM", "9:12 AM – 10:26 AM", "11:06 AM – 12:18 PM"][choice],
      cautionTime: ["3:12 PM – 4:28 PM", "1:42 PM – 2:56 PM", "4:08 PM – 5:16 PM"][choice],
      sections: [
        { key: "energy", title: "Overall energy", icon: "sun", content: "A steady approach will bring more progress than urgency. Complete one responsibility at a time." },
        { key: "family", title: "Family life", icon: "family", content: "A calm conversation with elders, spouse or children may clear a small misunderstanding.", premium: true },
        { key: "career", title: "Career & work", icon: "briefcase", content: "Review details before giving a commitment. Quiet preparation is favored over quick recognition.", premium: true },
        { key: "money", title: "Money awareness", icon: "money", content: "Avoid reacting quickly in money-related discussions. Let planned decisions rest until facts are clear.", premium: true },
        { key: "health", title: "Health routine", icon: "activity", content: "Keep meals regular, take gentle movement and allow sufficient rest. Seek professional care for any concern.", premium: true },
        { key: "relationships", title: "Relationships", icon: "heart", content: "Kind words will carry further than advice. Make space for another person’s point of view.", premium: true },
        { key: "spiritual", title: "Spiritual suggestion", icon: "flame", content: "Chant “Om Namah Shivaya” 11 times slowly in the morning.", premium: true },
        { key: "dos", title: "Do today", icon: "check", content: "Finish a pending family task, speak gently and keep the evening simple.", premium: true },
        { key: "avoid", title: "Be mindful of", icon: "x", content: "Avoid hurried decisions and carrying work tension into family time.", premium: true }
      ]
    };
  }

  if (period === "weekly") {
    return {
      ...base,
      period,
      label: "This week",
      focus: "Order, consistency and warm communication",
      summary: "This week favors steady routines and practical family planning. Small acts of reliability will create more harmony than big promises.",
      remedy: "On Thursday, offer fruit or a simple meal to someone in need without seeking recognition.",
      sections: [
        { key: "overview", title: "Week overview", icon: "calendar", content: "The first half supports planning; the second half asks for flexibility and rest." },
        { key: "family", title: "Family harmony", icon: "family", content: "Share responsibilities clearly. Wednesday supports a patient family discussion.", premium: true },
        { key: "work", title: "Work & responsibility", icon: "briefcase", content: "A pending task can move forward when you organise the small details first.", premium: true },
        { key: "finance", title: "Finance awareness", icon: "money", content: "Keep routine spending visible and avoid lending from a place of pressure.", premium: true },
        { key: "health", title: "Health routine", icon: "activity", content: "Protect sleep timing and include light movement on most days.", premium: true },
        { key: "best", title: "Favorable days", icon: "star", content: "Tuesday and Thursday support important conversations and focused work.", premium: true },
        { key: "calm", title: "Days to stay calm", icon: "moon", content: "On Saturday, reduce commitments and leave extra time between tasks.", premium: true }
      ]
    };
  }

  return {
    ...base,
    period,
    label: "This month",
    focus: "Strengthening foundations",
    summary: "The month encourages practical progress at home and work. Choose sustainable routines around money, rest and shared responsibilities.",
    remedy: "Light a diya on Monday evenings and spend five quiet minutes in gratitude for family support.",
    sections: [
      { key: "overview", title: "Month overview", icon: "calendar", content: "Progress grows through consistency. Avoid measuring the month by one unusually busy week." },
      { key: "career", title: "Career & work", icon: "briefcase", content: "The middle of the month supports a thoughtful proposal or new responsibility.", premium: true },
      { key: "money", title: "Money planning", icon: "money", content: "Review recurring expenses and keep long-term family needs ahead of impulse purchases.", premium: true },
      { key: "family", title: "Family & children", icon: "family", content: "Create one regular time for the family to speak without phones or distractions.", premium: true },
      { key: "health", title: "Health routine", icon: "activity", content: "Consistency in sleep, meals and movement is the favorable focus this month.", premium: true },
      { key: "spiritual", title: "Spiritual growth", icon: "flame", content: "Simple daily practice will feel more supportive than an elaborate one-time ritual.", premium: true },
      { key: "dates", title: "Important dates", icon: "star", content: "The 5th, 14th and 23rd support planning. Keep the 18th less crowded.", premium: true }
    ]
  };
}

export async function calculatePanchang(env: Bindings, profile: ProfileRow) {
  const provider = await providerRequest<Record<string, unknown>>(env, "/panchang", {
    date: new Date().toISOString().slice(0, 10),
    location: profile.current_city || profile.birth_place,
    timezone: profile.timezone,
    latitude: profile.latitude,
    longitude: profile.longitude
  });
  if (provider) return { ...provider, calculationMode: "provider" };
  if (env.ENVIRONMENT === "production") throw new Error("A Panchang provider must be configured in production.");
  return {
    date: new Date().toISOString().slice(0, 10),
    location: profile.current_city || profile.birth_place,
    tithi: "Shukla Navami",
    nakshatra: "Hasta",
    yoga: "Siddha",
    karana: "Balava",
    sunrise: "5:44 AM",
    sunset: "6:52 PM",
    rahuKalam: "12:18 PM – 1:56 PM",
    yamagandam: "7:22 AM – 9:01 AM",
    gulikaKalam: "10:39 AM – 12:18 PM",
    auspiciousPeriod: "9:18 AM – 10:28 AM",
    importantDay: "A favorable day for prayer, study and completing a family promise.",
    calculationMode: "estimated"
  };
}
