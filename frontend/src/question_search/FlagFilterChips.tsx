import React from "react";
import { Circle } from "lucide-react";
import { FLAG_METADATA, type FlagCategory } from "../components/FlagConstants";
import { UNFLAGGED, type FlagFilterKey } from "./question_search_types";
import styles from "./QuestionSearch.module.css";

interface FlagFilterChipsProps {
  selected: FlagFilterKey[];
  onChange: (next: FlagFilterKey[]) => void;
}

const CHIPS: { key: FlagFilterKey; label: string; icon: React.ReactNode }[] = [
  ...Object.entries(FLAG_METADATA).map(([key, meta]) => ({
    key: key as FlagCategory,
    label: meta.label,
    icon: meta.icon,
  })),
  { key: UNFLAGGED, label: "Unflagged", icon: <Circle /> },
];

export function FlagFilterChips({ selected, onChange }: FlagFilterChipsProps) {
  const toggle = (key: FlagFilterKey) => {
    onChange(
      selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key]
    );
  };

  return (
    <div className={styles.chipRow} role="group" aria-label="Filter by flag">
      {CHIPS.map(({ key, label, icon }) => {
        const active = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            className={`${styles.chip} ${active ? styles.chipActive : ""}`}
            onClick={() => toggle(key)}
          >
            {React.cloneElement(icon as React.ReactElement, {
              className: styles.chipIcon,
            })}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}