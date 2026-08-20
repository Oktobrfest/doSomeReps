export interface RepetitionInterval {
  levelNo: number;
  /** Days after which a question at this level comes back around. */
  daysHence: number;
}

export interface AboutBootstrap {
  images: {
    siteFormat: string;
    activeVsPassive: string;
    community: string;
    hourglass: string;
  };
  intervals: RepetitionInterval[];
}
