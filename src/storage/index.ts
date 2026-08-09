/**
 * Public storage API — the only persistence authority for ordinary app code.
 *
 * Do not re-export database handles or raw write primitives from here.
 * Capability to put/delete/clear decisions is exclusively DecisionRepository.
 */
export {
  repository,
  DecisionRepository,
  DomainError,
  type ImportMode,
  type DestructiveConfirm,
} from './repository'
