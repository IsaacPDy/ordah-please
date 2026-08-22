/** The immutable delivery address snapshot captured on each order. */
export interface DeliveryAddress {
  readonly recipientName: string;
  readonly phoneNumber: string;
  readonly lineOne: string;
  readonly lineTwo: string | null;
  readonly city: string;
  readonly postalCode: string | null;
  readonly notes: string | null;
}

/** Renders the courier-facing routing lines without recipient metadata. */
export function formatDeliveryAddress(address: DeliveryAddress): string {
  return [address.lineOne, address.lineTwo, address.city, address.postalCode]
    .filter((part): part is string => part !== null && part.trim().length > 0)
    .join(", ");
}
