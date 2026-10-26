import { describe, expect, it } from "vitest";
import { WARDROBE_TIERS, tierForRole, wardrobeFor } from "@/lib/characterWardrobe";
import { NPC_SPECS } from "@/lib/npcSim";

describe("character wardrobe", () => {
  it("maps NPC roles to pre-colonial tiers", () => {
    expect(tierForRole("trader")).toBe("commoner");
    expect(tierForRole("fisher")).toBe("commoner");
    expect(tierForRole("farmer")).toBe("commoner");
    expect(tierForRole("herder")).toBe("commoner");
    expect(tierForRole("elder")).toBe("elder");
    expect(tierForRole("guard")).toBe("warrior");
    expect(tierForRole("chief")).toBe("royal");
  });

  it("gives every tier a wardrobe for both genders", () => {
    for (const tier of WARDROBE_TIERS) {
      for (const g of ["male", "female"] as const) {
        expect(wardrobeFor(tier, g).garments.length).toBeGreaterThan(0);
      }
    }
  });

  it("every NPC spec resolves to a valid tier, including the chief", () => {
    expect(NPC_SPECS.some((s) => s.role === "chief")).toBe(true);
    for (const s of NPC_SPECS) expect(WARDROBE_TIERS).toContain(tierForRole(s.role));
  });
});
