import { afterEach, describe, expect, it, vi } from "vitest";
import { frontendUrl, publishChange } from "../../src/lib/publish";

describe("frontend revalidation", () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.REVALIDATE_SECRET;
    vi.restoreAllMocks();
  });

  it("uses the first origin when FRONTEND_URL lists several", () => {
    process.env.FRONTEND_URL = " https://site.test/ , http://localhost:3000";
    expect(frontendUrl()).toBe("https://site.test");
  });

  it("is off when FRONTEND_URL is empty", () => {
    process.env.FRONTEND_URL = " , ";
    expect(frontendUrl()).toBeNull();
  });

  it("calls only the live site, with the shared secret", async () => {
    process.env.FRONTEND_URL = "https://site.test,http://localhost:3000";
    process.env.REVALIDATE_SECRET = "s3cret";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await publishChange("projects");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://site.test/api/revalidate");
    expect((init?.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s3cret");
    expect(JSON.parse(String(init?.body))).toEqual({ tag: "projects" });
  });
});
