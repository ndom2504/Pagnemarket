import { Redirect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/src/auth";
import { SplashIntro } from "@/src/components/splash-intro";
import { homeForRoles } from "@/src/home-route";
import { colors } from "@/src/theme";

/** Reset only when the JS bundle reloads (cold start / refresh). */
let introPlayedThisLaunch = false;

export default function Index() {
  const { user, loading } = useAuth();
  const [introDone, setIntroDone] = useState(introPlayedThisLaunch);

  const onIntroDone = useCallback(() => {
    introPlayedThisLaunch = true;
    setIntroDone(true);
  }, []);

  if (!introDone) {
    return <SplashIntro onDone={onIntroDone} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/auth" />;
  return <Redirect href={homeForRoles(user.roles)} />;
}
