import { describe, expect, it } from "vitest";

import { formatDeliveryAddress, type DeliveryAddress } from "./delivery-address.js";

const address: DeliveryAddress = {
  recipientName: "Mia Tan",
  phoneNumber: "+63 900 000 0000",
  lineOne: "12 Sample Street",
  lineTwo: "Unit 4B",
  city: "Naga",
  postalCode: "4400",
  notes: "Ring the bell twice",
};

describe("formatDeliveryAddress", () => {
  it("joins the routing lines and skips null parts", () => {
    expect(formatDeliveryAddress(address)).toBe(
      "12 Sample Street, Unit 4B, Naga, 4400",
    );
  });

  it("omits optional parts that are null", () => {
    expect(
      formatDeliveryAddress({ ...address, lineTwo: null, postalCode: null }),
    ).toBe("12 Sample Street, Naga");
  });
});
