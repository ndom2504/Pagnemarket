import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform, Vibration } from "react-native";
import { storage } from "@/src/utils/storage";

export const MESSAGES_CHANNEL = "messages";
export const ORDERS_CHANNEL = "orders";
const PERM_ASKED_KEY = "notifications.permissionAsked";
const LAST_UNREAD_KEY = "notifications.lastUnreadMessages";
const LAST_ORDERS_KEY = "notifications.lastUnreadOrders";

/** Expo Go (SDK 53+) crashes if expo-notifications is imported on Android. */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const nativeNotificationsAvailable =
  Platform.OS !== "web" && !isExpoGo;

type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (!nativeNotificationsAvailable) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-notifications") as NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    cached = null;
  }
  return cached;
}

export async function ensureAndroidChannel() {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
    name: "Messages PagneMarket",
    description: "Nouveaux messages et alertes",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#B85C38",
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
    name: "Commandes PagneMarket",
    description: "Nouvelles commandes fournisseurs et tailleurs",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 400, 200, 400, 200, 400, 200, 600],
    lightColor: "#C9A227",
    enableVibrate: true,
    showBadge: true,
  });
}

export async function getNotificationPermissionStatus(): Promise<string> {
  const Notifications = getNotifications();
  if (!Notifications) return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Request OS permission (sound + banner). Safe to call multiple times. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await storage.setItem(PERM_ASKED_KEY, true);
    return true;
  }
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  await storage.setItem(PERM_ASKED_KEY, true);
  return next.granted;
}

/** Prompt once after login if not yet asked. */
export async function maybePromptNotificationPermission(): Promise<boolean> {
  if (!nativeNotificationsAvailable) return false;
  const asked = await storage.getItem(PERM_ASKED_KEY, false);
  if (asked) {
    const status = await getNotificationPermissionStatus();
    return status === "granted";
  }
  return requestNotificationPermission();
}

/** In-app ringtone (works in Expo Go too) + vibration. */
export async function playOrderRingtone() {
  try {
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 400, 180, 400, 180, 400, 180, 500]);
    }
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAudioPlayer, setAudioModeAsync } = require("expo-audio") as typeof import("expo-audio");
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      interruptionModeAndroid: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
    const player = createAudioPlayer(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../assets/sounds/order_ring.wav"),
    );
    player.volume = 1;
    player.play();
    const releaseLater = () => {
      try {
        player.remove();
      } catch {
        /* ignore */
      }
    };
    player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) releaseLater();
    });
    setTimeout(releaseLater, 8000);
  } catch {
    /* Expo Go / web / missing asset — vibration already ran */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require("expo-haptics");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* ignore */
  }
}

export async function presentLocalNotification(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return;
  await ensureAndroidChannel();
  const channelId = opts.channelId || MESSAGES_CHANNEL;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      sound: "default",
      data: opts.data || {},
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: null,
  });
}

/** When unread message count rises, ring a local notification (poll-based). */
export async function notifyIfUnreadIncreased(unreadMessages: number) {
  if (!nativeNotificationsAvailable) return;
  const prev = Number((await storage.getItem(LAST_UNREAD_KEY, 0)) || 0);
  await storage.setItem(LAST_UNREAD_KEY, unreadMessages);
  if (unreadMessages <= prev) return;
  const delta = unreadMessages - prev;
  await presentLocalNotification({
    title: delta === 1 ? "Nouveau message" : `${delta} nouveaux messages`,
    body: "Ouvrez PagneMarket pour répondre.",
    data: { kind: "message" },
    channelId: MESSAGES_CHANNEL,
  });
}

/** New paid marketplace / sewing orders — banner + ringtone. */
export async function notifyIfOrdersIncreased(
  unreadOrders: number,
  latest?: { title?: string; body?: string; kind?: string; data?: Record<string, unknown> } | null,
) {
  const prev = Number((await storage.getItem(LAST_ORDERS_KEY, 0)) || 0);
  await storage.setItem(LAST_ORDERS_KEY, unreadOrders);
  if (unreadOrders <= prev) return;

  const title =
    latest?.title ||
    (unreadOrders - prev === 1 ? "Nouvelle commande" : `${unreadOrders - prev} nouvelles commandes`);
  const body = latest?.body || "Ouvrez PagneMarket pour traiter la commande.";
  const data = {
    kind: latest?.kind || "order",
    ...(latest?.data || {}),
  };

  await playOrderRingtone();
  await presentLocalNotification({
    title,
    body,
    data,
    channelId: ORDERS_CHANNEL,
  });
}

export function addNotificationResponseListener(
  listener: (data: Record<string, unknown>) => void,
): { remove: () => void } | null {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<
      string,
      unknown
    >;
    listener(data);
  });
  return sub;
}

export function formatBadgeCount(n: number): string | undefined {
  if (!n || n < 1) return undefined;
  return n > 99 ? "99+" : String(n);
}
