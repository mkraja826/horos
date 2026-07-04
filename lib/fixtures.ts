import type { BirthChart, HoroscopeReading, Panchang, UserProfile } from "@/types/models";

const generatedAt = new Date().toISOString();

export const demoProfile: UserProfile = {
  id: "local-user",
  fullName: "Ananya Rao",
  identifier: "+91 98765 43210",
  gender: "Female",
  language: "English",
  notificationTime: "06:00",
  notificationsEnabled: false,
  birth: {
    dateOfBirth: "1986-08-14",
    timeOfBirth: "07:30",
    birthPlace: "Hyderabad, Telangana, India",
    currentCity: "Hyderabad",
    timezone: "Asia/Kolkata",
    latitude: 17.385,
    longitude: 78.4867
  },
  rashi: "Vrishabha",
  nakshatra: "Rohini",
  lagna: "Simha"
};

export function dailyFixture(profile = demoProfile): HoroscopeReading {
  return {
    period: "daily",
    label: "Today’s guidance",
    focus: "Patient family conversations",
    summary: `Today supports ${profile.rashi} natives in handling family responsibilities with patience. Listen fully before responding, especially when plans or expenses are discussed.`,
    luckyColor: "Soft saffron",
    luckyColorHex: "#D98B43",
    luckyNumber: 6,
    mantra: "Om Namah Shivaya",
    remedy: "Light a small diya in the morning and sit quietly for two minutes before beginning important work.",
    auspiciousTime: "10:24 AM – 11:38 AM",
    cautionTime: "3:12 PM – 4:28 PM",
    generatedAt,
    calculationMode: "estimated",
    sections: [
      {
        key: "energy",
        title: "Overall energy",
        icon: "sun",
        content: "A steady approach will bring more progress than urgency. Complete one responsibility at a time."
      },
      {
        key: "family",
        title: "Family life",
        icon: "family",
        content: "A calm conversation with elders, spouse or children may clear a small misunderstanding."
      },
      {
        key: "career",
        title: "Career & work",
        icon: "briefcase",
        content: "Review details before giving a commitment. Quiet preparation is more favorable than seeking quick recognition.",
        premium: true
      },
      {
        key: "money",
        title: "Money awareness",
        icon: "money",
        content: "Avoid reacting quickly in money-related discussions. A planned purchase can wait until the facts are clear.",
        premium: true
      },
      {
        key: "health",
        title: "Health routine",
        icon: "activity",
        content: "Keep meals regular, take a gentle walk and allow a little extra rest. Seek professional care for any concern.",
        premium: true
      },
      {
        key: "relationships",
        title: "Relationships",
        icon: "heart",
        content: "Kind words will carry further than advice today. Make space for another person’s point of view.",
        premium: true
      },
      {
        key: "spiritual",
        title: "Spiritual suggestion",
        icon: "flame",
        content: "Chant “Om Namah Shivaya” 11 times slowly in the morning to create a centered beginning.",
        premium: true
      },
      {
        key: "dos",
        title: "Do today",
        icon: "check",
        content: "Finish a pending family task, speak gently and keep the evening simple.",
        premium: true
      },
      {
        key: "avoid",
        title: "Be mindful of",
        icon: "x",
        content: "Avoid hurried decisions, repeated arguments and carrying work tension into family time.",
        premium: true
      }
    ]
  };
}

export function weeklyFixture(): HoroscopeReading {
  return {
    period: "weekly",
    label: "This week",
    focus: "Order, consistency and warm communication",
    summary:
      "This week favors steady routines and practical family planning. Small acts of reliability will create more harmony than big promises.",
    remedy: "On Thursday, offer fruit or a simple meal to someone in need without seeking recognition.",
    generatedAt,
    calculationMode: "estimated",
    sections: [
      { key: "overview", title: "Week overview", icon: "calendar", content: "The first half supports planning; the second half asks for flexibility and rest." },
      { key: "family", title: "Family harmony", icon: "family", content: "Share responsibilities clearly. Wednesday is favorable for a patient family discussion.", premium: true },
      { key: "work", title: "Work & responsibility", icon: "briefcase", content: "A pending task can move forward when you organise the small details first.", premium: true },
      { key: "finance", title: "Finance awareness", icon: "money", content: "Keep routine spending visible and avoid lending from a place of pressure.", premium: true },
      { key: "health", title: "Health routine", icon: "activity", content: "Protect sleep timing and include light movement on most days.", premium: true },
      { key: "best", title: "Favorable days", icon: "star", content: "Tuesday and Thursday support important conversations and focused work.", premium: true },
      { key: "calm", title: "Days to stay calm", icon: "moon", content: "On Saturday, reduce commitments and leave extra time between tasks.", premium: true }
    ]
  };
}

export function monthlyFixture(): HoroscopeReading {
  return {
    period: "monthly",
    label: "This month",
    focus: "Strengthening foundations",
    summary:
      "The month encourages practical progress at home and work. Choose sustainable routines, especially around money, rest and shared responsibilities.",
    remedy: "Light a diya on Monday evenings and spend five quiet minutes in gratitude for family support.",
    generatedAt,
    calculationMode: "estimated",
    sections: [
      { key: "overview", title: "Month overview", icon: "calendar", content: "Progress grows through consistency. Avoid measuring the month by one unusually busy week." },
      { key: "career", title: "Career & work", icon: "briefcase", content: "The middle of the month supports a thoughtful proposal or new responsibility.", premium: true },
      { key: "money", title: "Money planning", icon: "money", content: "Review recurring expenses and keep long-term family needs ahead of impulse purchases.", premium: true },
      { key: "family", title: "Family & children", icon: "family", content: "Create one regular time for the family to speak without phones or distractions.", premium: true },
      { key: "health", title: "Health routine", icon: "activity", content: "Consistency in sleep, meals and movement is the favorable focus this month.", premium: true },
      { key: "spiritual", title: "Spiritual growth", icon: "flame", content: "Simple daily practice will feel more supportive than an elaborate one-time ritual.", premium: true },
      { key: "dates", title: "Important dates", icon: "star", content: "The 5th, 14th and 23rd are supportive for planning. Keep the 18th less crowded.", premium: true }
    ]
  };
}

export const panchangFixture: Panchang = {
  date: new Date().toISOString().slice(0, 10),
  location: "Hyderabad, India",
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

export function chartFixture(profile = demoProfile): BirthChart {
  return {
    rashi: profile.rashi,
    nakshatra: profile.nakshatra,
    lagna: profile.lagna,
    birthStar: `${profile.nakshatra} – 2nd Pada`,
    element: "Earth",
    nature: "Steady and nurturing",
    strengths: ["Patient decision-making", "Care for family", "Practical use of resources"],
    challenges: ["Holding worries silently", "Taking on too much responsibility"],
    lifestyleBalance:
      "Keep dependable routines, but leave room for rest and changing plans. Speaking needs early prevents avoidable pressure.",
    dasha: "Jupiter major period · estimated",
    calculationMode: "estimated"
  };
}
