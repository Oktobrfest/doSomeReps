export interface LandingBootstrap {
  signupUrl: string;
  loginUrl: string;
  images: {
    graduationHat: string;
    eduTree: string;
  };
  /** Base64-encoded PNGs of the charts, rendered server-side. */
  forgettingChart: string;
  categoriesChart: string;
}
