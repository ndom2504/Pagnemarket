import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_COUNTRIES, COUNTRIES, type Country } from "@/src/countries";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Props = {
  value: Country;
  onChange: (c: Country) => void;
  testID?: string;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
};

export function CountryPicker({
  value,
  onChange,
  testID,
  allowAll,
  allLabel = "Tous les pays",
  compact,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const data = useMemo(() => {
    const list = !q.trim()
      ? COUNTRIES
      : COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    return allowAll ? [{ ...ALL_COUNTRIES, name: allLabel }, ...list] : list;
  }, [q, allowAll, allLabel]);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <Pressable
        testID={testID || "country-picker"}
        style={[styles.field, compact && styles.fieldCompact]}
        onPress={() => setOpen(true)}
      >
        <Icon name="globe" size={16} color={colors.muted} />
        <Text style={styles.fieldTxt} numberOfLines={1}>
          {value.iso === "ALL" ? allLabel : value.name}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={close} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.title}>Choisir un pays</Text>
            <TextInput
              testID="country-search"
              style={styles.search}
              placeholder="Rechercher un pays…"
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={setQ}
              autoFocus={Platform.OS !== "ios"}
            />
            <FlatList
              data={data}
              keyExtractor={(i) => i.iso}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              keyboardDismissMode="on-drag"
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`country-${item.iso}`}
                  style={styles.row}
                  onPress={() => {
                    onChange(item);
                    close();
                  }}
                >
                  <Text style={styles.rowName}>{item.name}</Text>
                  {!!item.dial && <Text style={styles.rowDial}>{item.dial}</Text>}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: colors.surfaceTertiary,
  },
  fieldCompact: { marginBottom: 0, paddingVertical: 10, paddingHorizontal: 12 },
  fieldTxt: { flex: 1, fontSize: 15, color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "500", color: colors.onSurface, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    color: colors.onSurface,
    backgroundColor: colors.surfaceTertiary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowName: { color: colors.onSurface, fontSize: 15 },
  rowDial: { color: colors.muted, fontSize: 13 },
});
