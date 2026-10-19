import { afterEach, describe, expect, it } from "vitest";
import { setTurnstileToken, turnstileHeaders } from "./turnstile";

describe("turnstileHeaders", () => {
  afterEach(() => setTurnstileToken(null));

  it("sin token no manda nada", () => {
    expect(turnstileHeaders("/auth/login")).toEqual({});
  });

  it("manda el token sólo a login y registro", () => {
    setTurnstileToken("tok");
    expect(turnstileHeaders("/auth/login")).toEqual({ "X-Turnstile-Token": "tok" });
    expect(turnstileHeaders("/auth/register")).toEqual({ "X-Turnstile-Token": "tok" });
    expect(turnstileHeaders("/shifts/feed")).toEqual({});
    expect(turnstileHeaders("/auth/refresh")).toEqual({});
  });
});
