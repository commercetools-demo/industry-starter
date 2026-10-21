/** A review by this customer for this product exists already (uniquenessValue or the pre-check). */
export class AlreadyReviewedError extends Error {
  constructor(readonly reviewId: string | null) {
    super('already_reviewed');
    this.name = 'AlreadyReviewedError';
  }
}
