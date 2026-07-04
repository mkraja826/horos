import React from "react";

import { HoroscopeScreen } from "@/components/horoscope-screen";
import { useMonthlyReading } from "@/hooks/use-vedic-data";

export default function MonthlyScreen() {
  const reading = useMonthlyReading();
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
