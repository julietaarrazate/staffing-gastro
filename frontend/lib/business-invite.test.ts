import { describe, expect, it } from "vitest";
import { BUSINESS_INVITE_URL, buildBusinessInviteText } from "./business-invite";

describe("invitación a un comercio", () => {
  it("lleva al alta con el rol de comercio ya elegido", () => {
    expect(BUSINESS_INVITE_URL).toBe("https://oido.com.ar/register?rol=comercio");
  });

  it("incluye el link en el mensaje", () => {
    expect(buildBusinessInviteText()).toContain(BUSINESS_INVITE_URL);
  });
});
