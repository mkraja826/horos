import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { api, isApiConfigured } from "@/lib/api-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: Number.isFinite(hour) ? hour : 6, minute: Number.isFinite(minute) ? minute : 0 };
}

export async function enableGuidanceNotifications(notificationTime: string) {
  if (!Device.isDevice) throw new Error("Notifications need a physical phone for testing.");

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Notification permission was not granted.");

  await Notifications.cancelAllScheduledNotificationsAsync();
  const { hour, minute } = parseTime(notificationTime);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Namaste 🙏",
      body: "Your daily Vedic guidance is ready.",
      data: { route: "/daily" }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute
    }
  });

  await Notifications.scheduleNotificationAsync({
    content: { title: "Weekly guidance", body: "Your weekly horoscope is ready.", data: { route: "/weekly" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour,
      minute
    }
  });

  await Notifications.scheduleNotificationAsync({
    content: { title: "New month guidance", body: "Your monthly horoscope is ready.", data: { route: "/monthly" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour,
      minute
    }
  });

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (projectId && isApiConfigured) {
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.registerNotification(pushToken, notificationTime);
  }
}

export async function disableGuidanceNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
