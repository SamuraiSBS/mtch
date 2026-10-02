import { describe, expect, it } from "vitest";
import { companyInput } from "@/server/validation";

const id = "00000000-0000-4000-8000-000000000001";
const company = {
  name: "MTCH", description: "Reverse hiring", workFormat: "REMOTE", foundedYear: 2018,
  sizeBand: "11-50", industry: "Разработка ПО", websiteUrl: null, logoFileId: id,
  contactEmail: null, telegram: null, phone: null,
};

describe("company wizard payload validation", () => {
  it("keeps existing API requests valid when collections are omitted", () => {
    const result = companyInput.parse(company);
    expect(result.photos).toBeUndefined();
    expect(result.socialLinks).toBeUndefined();
  });

  it("accepts separate accounts on one platform and photo order by category", () => {
    const result = companyInput.safeParse({
      ...company,
      socialLinks: [{ platform: "TELEGRAM", value: "@team" }, { platform: "TELEGRAM", value: "@careers" }],
      photos: [
        { fileId: id, category: "OFFICE", sortOrder: 0 },
        { fileId: "00000000-0000-4000-8000-000000000002", category: "TEAM", sortOrder: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate social records even when casing or whitespace differs", () => {
    const result = companyInput.safeParse({
      ...company,
      socialLinks: [{ platform: "VK", value: "https://vk.com/company" }, { platform: "VK", value: " https://vk.com/Company " }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects repeated photo file ids and collections above 20 photos", () => {
    expect(companyInput.safeParse({ ...company, photos: [
      { fileId: id, category: "OTHER", sortOrder: 0 }, { fileId: id, category: "OTHER", sortOrder: 1 },
    ] }).success).toBe(false);
    const photos = Array.from({ length: 21 }, (_, index) => ({
      fileId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      category: "OFFICE", sortOrder: index,
    }));
    expect(companyInput.safeParse({ ...company, photos }).success).toBe(false);
  });

  it("requires founded years within the current range and known categories", () => {
    expect(companyInput.safeParse({ ...company, foundedYear: 1799 }).success).toBe(false);
    expect(companyInput.safeParse({ ...company, foundedYear: new Date().getFullYear() + 1 }).success).toBe(false);
    expect(companyInput.safeParse({ ...company, photos: [{ fileId: id, category: "UNKNOWN", sortOrder: 0 }] }).success).toBe(false);
  });
});
