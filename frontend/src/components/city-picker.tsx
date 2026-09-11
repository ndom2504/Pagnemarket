import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { citiesFor } from "@/src/cities";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Props = {
  countryIso?: string | null;
  value: string;
  onChange: (city: string) => void;
  testID?: string;
  placeholder?: string;
  compact?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
};

export function CityPicker({
  countryIso,
  value,
  onChange,
  testID,
  placeholder = "Choisir une ville",
  compact,
  allowAll,
  allLabel = "Toutes les villes",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cities = useMemo(() => citiesFor(countryIso), [countryIso]);
  const data = useMemo(() => {
    const list = !q.trim()
      ? cities
      : cities.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase()));
    return allowAll ? [allLabel, ...list] : list;
  }, [cities, q, allowAll, allLabel]);

  const label = !value ? placeholder : value === allLabel || value === "all" ? allLabel : value;

  return (
    <>
      <Pressable
        testID={testID || "city-picker"}
        style={[styles.field, compact && styles.fieldCompact, disabled && { opacity: 0.5 }]}
        onPress={() => {
          if (!disabled && cities.length) setOpen(true);
        }}
      >
        <Icon name="map-pin" size={16} color={colors.muted} />
        <Text style={[styles.fieldTxt, !value && { color: colors.muted }]} numberOfLines={1}>
          {label}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Choisir une ville</Text>
            <TextInput
              testID="city-search"
              style={styles.search}
              placeholder="Rechercher une ville…"
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={setQ}
              autoFocus
            />
            <FlatList
              data={data}
              keyExtractor={(i) => i}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`city-${item}`}
                  style={styles.row}
                  onPress={() => {
                    onChange(item === allLabel ? "all" : item);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Text style={styles.rowName}>{item}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
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
    paddingBottom: 28,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowName: { color: colors.onSurface, fontSize: 15 },
});
