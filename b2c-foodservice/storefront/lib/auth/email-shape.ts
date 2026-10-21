const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape only (client and server): the real check is commercetools accepting the address. */
export function isEmailShape(value: string): boolean {
  return value.length <= 254 && EMAIL_SHAPE.test(value);
}
