import type { DealStatus, FineStatus, LeaseStatus, TransferStatus } from '@renawi/shared';

/**
 * Linear lifecycles of the records that have one (`LifecycleSteps` draws them). Vehicles and
 * taxi licences have no lifecycle: their statuses are not a line (leased cars return to stock),
 * so they keep the status tag only.
 *
 * - `paths`: the happy paths, first one is the default (a status on several paths, such as a
 *   fine's NEW, shows the first).
 * - `offPath`: terminal statuses outside the paths (TERMINATED, CANCELLED), each with the last
 *   step it can be reached from. It is drawn as an error step that replaces the remaining ones.
 */
export interface LifecycleDef<S extends string> {
  /** Labelled enum of the statuses (`enums.<enumName>.<VALUE>`). */
  enumName: 'LeaseStatus' | 'DealStatus' | 'TransferStatus' | 'FineStatus';
  paths: readonly (readonly S[])[];
  offPath?: Readonly<Partial<Record<S, S>>>;
}

/** Status type of each lifecycle. */
interface LifecycleStatuses {
  lease: LeaseStatus;
  deal: DealStatus;
  transfer: TransferStatus;
  fine: FineStatus;
}

export type LifecycleName = keyof LifecycleStatuses;

/** Status type of a lifecycle, e.g. `LifecycleStatus<'lease'>` = `LeaseStatus`. */
export type LifecycleStatus<L extends LifecycleName> = LifecycleStatuses[L];

export const LIFECYCLES: { readonly [L in LifecycleName]: LifecycleDef<LifecycleStatuses[L]> } = {
  lease: {
    enumName: 'LeaseStatus',
    paths: [['DRAFT', 'ACTIVE', 'ENDED']],
    // Only an active contract can be terminated early.
    offPath: { TERMINATED: 'ACTIVE' },
  },
  deal: {
    enumName: 'DealStatus',
    paths: [['DRAFT', 'PENDING', 'COMPLETED']],
    // The deal does not record the step it was cancelled from: shown after the draft.
    offPath: { CANCELLED: 'DRAFT' },
  },
  transfer: {
    enumName: 'TransferStatus',
    paths: [['NOT_STARTED', 'IN_PROGRESS', 'DONE']],
  },
  fine: {
    enumName: 'FineStatus',
    paths: [
      ['NEW', 'REASSIGN_SUBMITTED', 'REASSIGNED'],
      ['NEW', 'PAID_BY_US'],
    ],
    offPath: { CANCELLED: 'NEW' },
  },
};

/** AntD `Steps` item status. */
export type StepState = 'finish' | 'process' | 'wait' | 'error';

export interface LifecycleStep<S extends string = string> {
  status: S;
  state: StepState;
  /** The record's current status (the step that pulses, or the error / final step). */
  current: boolean;
}

/**
 * Steps of a lifecycle for a status: done steps `finish`, the current one `process` (`finish`
 * when it is the last step, nothing follows), later ones `wait`. An off-path status keeps the
 * steps up to the one it was reached from (`reached` overrides the definition's default) and
 * adds itself as an `error` step instead of the rest. Unknown statuses give the default path,
 * all waiting.
 */
export function lifecycleSteps<S extends string>(
  def: LifecycleDef<S>,
  status: S,
  reached?: S,
): LifecycleStep<S>[] {
  const offFrom = def.offPath?.[status];
  if (offFrom !== undefined) {
    const from = reached ?? offFrom;
    const path = def.paths.find((p) => p.includes(from)) ?? def.paths[0] ?? [];
    const upTo = Math.max(0, path.indexOf(from));
    return [
      ...path
        .slice(0, upTo + 1)
        .map((s) => ({ status: s, state: 'finish' as const, current: false })),
      { status, state: 'error', current: true },
    ];
  }

  const path = def.paths.find((p) => p.includes(status)) ?? def.paths[0] ?? [];
  const index = path.indexOf(status);
  return path.map((s, i) => {
    if (index < 0 || i > index) return { status: s, state: 'wait', current: false };
    if (i < index) return { status: s, state: 'finish', current: false };
    const last = i === path.length - 1;
    return { status: s, state: last ? 'finish' : 'process', current: true };
  });
}
