import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export type AppleAuthExtra = {
  role?: string;
  city?: string;
  country?: string;
  shopName?: string;
  specialty?: string;
};

export type AppleSignInResult = {
  identityToken: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/** Native Sign in with Apple — iOS only (not Expo Go / Android / web). */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function promptAppleSignIn(): Promise<AppleSignInResult | null> {
  const available = await isAppleAuthAvailable();
  if (!available) {
    throw new Error("Sign in with Apple n’est disponible que sur iPhone / iPad");
  }
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) {
      throw new Error("Apple n’a pas renvoyé de jeton d’identité");
    }
    return {
      identityToken: cred.identityToken,
      email: cred.email,
      firstName: cred.fullName?.givenName ?? null,
      lastName: cred.fullName?.familyName ?? null,
    };
  } catch (e: any) {
    // User cancelled
    if (e?.code === "ERR_REQUEST_CANCELED" || e?.code === "ERR_CANCELED") {
      return null;
    }
    throw e;
  }
}
