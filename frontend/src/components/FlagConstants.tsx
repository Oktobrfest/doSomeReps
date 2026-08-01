import React from 'react';
import { Wrench, ShieldAlert, BookOpen, Trash2, Flag } from 'lucide-react';

export enum FlagCategory {
  NEEDS_CHANGES = "NEEDS_CHANGES",
  INAPPROPRIATE = "INAPPROPRIATE",
  STUDY_ME = "STUDY_ME",
}

export interface FlagMetadata {
  label: string;
  icon: React.ReactNode;
}

export const FLAG_METADATA: Record<FlagCategory, FlagMetadata> = {
  [FlagCategory.NEEDS_CHANGES]: {
    label: "Needs Changes",
    icon: <Wrench />,
  },
  [FlagCategory.INAPPROPRIATE]: {
    label: "Inappropriate",
    icon: <ShieldAlert />,
  },
  [FlagCategory.STUDY_ME]: {
    label: "Study Me",
    icon: <BookOpen />,
  },
};

export const REMOVE_FLAG_METADATA = {
  label: "Remove Flag",
  icon: <Trash2 />,
};

export const DEFAULT_FLAG_METADATA = {
  label: "Flag",
  icon: <Flag />,
};
