import type React from 'react'
import { isEddyBuild } from '../../../shared/eddy/eddy-build'

/**
 * Orca cloud features eddy hasn't adopted (mobile companion, Orca account, sharing, feedback).
 * They stay visible but disabled in eddy release builds, marked "(orca feat)" so they're easy
 * to find when we replace or remove them.
 */
export const ORCA_FEATURE_DISABLED = isEddyBuild()

const ORCA_FEATURE_MARK = '(orca feat)'

/** Appends "(orca feat)" to a label or tooltip in eddy release builds. */
export function orcaFeatureLabel(label: string): string {
  return ORCA_FEATURE_DISABLED ? `${label} ${ORCA_FEATURE_MARK}` : label
}

/** Disables every control inside an Orca feature's pane or form in eddy release builds. */
export function OrcaFeatureGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  if (!ORCA_FEATURE_DISABLED) {
    return <>{children}</>
  }
  return (
    <fieldset disabled title={`Orca cloud feature, not available in eddy ${ORCA_FEATURE_MARK}`}>
      {children}
    </fieldset>
  )
}
