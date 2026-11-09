/** A stored document does not match the shape owned by `specs/03-data-model.md`. */
export class InvalidDocumentError extends Error {
  constructor(
    readonly path: string,
    readonly field: string
  ) {
    super(`Invalid document ${path}: field "${field}"`);
    this.name = 'InvalidDocumentError';
  }
}

/** A write rejected before reaching Firestore; `codes` are the domain error codes a form shows. */
export class ValidationFailedError<TCode extends string = string> extends Error {
  constructor(readonly codes: readonly TCode[]) {
    super(`Validation failed: ${codes.join(', ')}`);
    this.name = 'ValidationFailedError';
  }
}
