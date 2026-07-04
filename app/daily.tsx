import React from "react";

import { HoroscopeScreen } from "@/components/horoscope-screen";
import { useDailyReading } from "@/hooks/use-vedic-data";

export default function DailyScreen() {
  const reading = useDailyReading();
  return (
    <HoroscopeScreen
      reading={reading.data}
      loading={reading.isLoading}
      error={reading.isError}
      onRetry={() => reading.refetch()}
    />
  );
}
