import React from 'react';
import { Wrench, ShieldAlert, BookOpen, Trash2, Flag } from 'lucide-react';
import sharedStyles from '../styles/shared.module.css';

export enum FlagCategory {
  NEEDS_CHANGES = "NEEDS_CHANGES",
  INAPPROPRIATE = "INAPPROPRIATE",
  STUDY_ME = "STUDY_ME",
}

export interface FlagMetadata {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}

export const FLAG_METADATA: Record<FlagCategory, FlagMetadata> = {
  [FlagCategory.NEEDS_CHANGES]: {
    label: "Needs Changes",
    icon: <Wrench />,
    colorClass: sharedStyles.flagOther,
  },
  [FlagCategory.INAPPROPRIATE]: {
    label: "Inappropriate",
    icon: <ShieldAlert />,
    colorClass: sharedStyles.flagOther,
  },
  [FlagCategory.STUDY_ME]: {
    label: "Study Me",
    icon: <BookOpen />,
    colorClass: sharedStyles.flagStudyMe,
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
