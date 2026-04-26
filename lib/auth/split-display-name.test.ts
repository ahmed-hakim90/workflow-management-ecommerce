import { describe, expect, it } from "vitest";
import { splitDisplayName } from "./split-display-name";

describe("splitDisplayName", () => {
  it("empty and whitespace → both empty", () => {
    expect(splitDisplayName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName("  ")).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName(undefined)).toEqual({ firstName: "", lastName: "" });
  });

  it("one word → firstName only (common server single-token name)", () => {
    expect(splitDisplayName("Rivers")).toEqual({
      firstName: "Rivers",
      lastName: "",
    });
  });

  it("first space splits first and last", () => {
    expect(splitDisplayName("Alex Rivers")).toEqual({
      firstName: "Alex",
      lastName: "Rivers",
    });
  });

  it("multiple spaces: remainder trimmed as last name", () => {
    expect(splitDisplayName("Alex  Rivers  Jr")).toEqual({
      firstName: "Alex",
      lastName: "Rivers  Jr",
    });
  });

  it("leading/trailing space on full string is trimmed from whole", () => {
    expect(splitDisplayName("  Pat Smith  ")).toEqual({
      firstName: "Pat",
      lastName: "Smith",
    });
  });
});
