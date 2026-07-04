import React from "react";

import { HoroscopeScreen } from "@/components/horoscope-screen";
import { useWeeklyReading } from "@/hooks/use-vedic-data";

export default function WeeklyScreen() {
  const reading = useWeeklyReading();
  return (
    <HoroscopeScreen
      reading={reading.data}
      loading={reading.isLoading}
      error={reading.isError}
      onRetry={() => reading.refetch()}
      periodRequiresPremium
    />
  );
}
