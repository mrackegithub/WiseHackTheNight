export interface StepProps {
  /** Called after the step saved successfully. */
  onNext: () => void;
  onBack?: () => void;
}
