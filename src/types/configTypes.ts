export interface Configuration {
  // Filters to enable/disable detectors
  detectors: DetectorSettings;
}

export interface DetectorSettings {
  // Signifies whether the detector output will be used in diagnostics, etc.
  enabled: boolean;

  // A set of detector.check identifiers which we will hide.
  hiddenChecks: string[];
}
