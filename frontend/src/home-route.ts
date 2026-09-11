/** Home route after login, based on primary account role. */
export function homeForRoles(
  roles?: string[] | null
): "/admin" | "/supplier" | "/tailor" | "/(tabs)" {
  const r = roles || [];
  if (r.includes("admin")) return "/admin";
  if (r.includes("supplier")) return "/supplier";
  if (r.includes("tailor")) return "/tailor";
  return "/(tabs)";
}
