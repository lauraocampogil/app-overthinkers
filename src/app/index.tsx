import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ondas } from "@/components/Ondas";
import {
  Dock,
  FlameIcon,
  IconCircle,
  PersonIcon,
  Screen,
} from "@/components/ui";
import { t, todayLabel } from "@/i18n";
import { isoDay } from "@/lib/streak";
import { pendingTasks, useDay } from "@/store/day";
import { colors, fonts, type } from "@/theme";

export default function Inicio() {
  const streak = useDay((s) => s.streak);
  const later = useDay((s) => s.later);
  const plan = useDay((s) => s.plan);
  const planDate = useDay((s) => s.planDate);

  const active =
    planDate === isoDay(new Date())
      ? plan.filter((t) => t.status !== "quitada")
      : [];
  const pending = pendingTasks(active);
  const waiting = later.slice(0, 2).map((t) => t.title.toLowerCase());
  const extra = later.length - waiting.length;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.date}>{todayLabel()}</Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("streak.open")}: ${t("home.streak", { n: streak.current })}`}
            onPress={() => router.push("/racha")}
            style={styles.pill}
            hitSlop={6}
          >
            <FlameIcon />
            <Text style={styles.pillText}>
              {t("home.streak", { n: streak.current })}
            </Text>
          </Pressable>
          <IconCircle
            label={t("account.title")}
            onPress={() => router.push("/cuenta")}
            size={34}
          >
            <PersonIcon />
          </IconCircle>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={type.title} accessibilityRole="header">
          {t("home.title")}
        </Text>
        <Text style={type.muted}>{t("home.subtitle")}</Text>
      </View>

      <View style={styles.center}>
        <Ondas mode="calma" height={300} />
      </View>

      {pending.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/ahora")}
          style={styles.resume}
        >
          <Text style={styles.resumeText}>
            {t("home.resume", {
              done: active.length - pending.length,
              total: active.length,
            })}
          </Text>
        </Pressable>
      ) : later.length > 0 ? (
        <Text style={styles.waiting}>
          {t("home.waiting", { list: waiting.join(" · ") })}
          {extra > 0 ? t("home.more", { n: extra }) : ""}
        </Text>
      ) : null}

      <View style={styles.dock}>
        <Dock
          onWrite={() => router.push("/escribir")}
          onSpeak={() => router.push("/escuchando")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    height: 44,
    marginTop: 8,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.white,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  titleBlock: { paddingHorizontal: 24, marginTop: 32, gap: 10 },
  center: { flex: 1, justifyContent: "center" },
  waiting: {
    ...type.muted,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  resume: {
    alignSelf: "center",
    marginBottom: 18,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  resumeText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.accentDark,
  },
  dock: { paddingBottom: 12 },
});
