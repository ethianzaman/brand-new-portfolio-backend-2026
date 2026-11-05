import { beforeAll, describe, expect, it } from "vitest";
import { api, PASSWORD, signIn } from "../support/helpers";
import { User } from "../../src/models/User";
import { seedAdmin } from "../../src/lib/seedAdmin";

describe("sessions", () => {
  beforeAll(async () => {
    await User.deleteMany({});
  });

  it("logs in, knows who you are, and logs out", async () => {
    const cookie = await signIn("admin", "admin@test.invalid");
    const me = await api.get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toContain("password");

    const out = await api.post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(200);
    expect(out.headers["set-cookie"][0]).toMatch(/token=;/);
  });

  it("refuses a wrong password the same way as an unknown email", async () => {
    await User.create({ email: "real@test.invalid", password: PASSWORD, role: "editor" });
    const wrong = await api.post("/api/auth/login").send({ email: "real@test.invalid", password: "nope" });
    const unknown = await api.post("/api/auth/login").send({ email: "ghost@test.invalid", password: "nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("rejects an operator injected into the login", async () => {
    const res = await api.post("/api/auth/login").send({ email: { $ne: "" }, password: "x" });
    expect(res.status).toBe(400);
  });

  it("changing the password ends other sessions", async () => {
    const cookie = await signIn("manager", "changer@test.invalid");
    const wrong = await api
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "nope", newPassword: "An0ther-Strong-Pass!" });
    expect(wrong.status).toBe(400);

    const ok = await api
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: "An0ther-Strong-Pass!" });
    expect(ok.status).toBe(200);

    const old = await api.get("/api/auth/me").set("Cookie", cookie);
    expect(old.status).toBe(401);
  });

  it("a disabled account can't keep using its session", async () => {
    const cookie = await signIn("editor", "disabled@test.invalid");
    await User.updateOne({ email: "disabled@test.invalid" }, { isActive: false });
    const res = await api.get("/api/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });
});

describe("permissions", () => {
  let editor: string;
  let superAdmin: string;

  beforeAll(async () => {
    await User.deleteMany({});
    editor = await signIn("editor");
    superAdmin = await signIn("super_admin");
  });

  it("an editor can edit content but not delete it", async () => {
    const edit = await api
      .put("/api/hero/stats")
      .set("Cookie", editor)
      .send({ stats: [{ value: "1+", label: "Years" }] });
    expect(edit.status).toBe(200);

    const remove = await api.delete("/api/hero/stats/64b000000000000000000000").set("Cookie", editor);
    expect(remove.status).toBe(403);
  });

  it("only a super admin can change role permissions", async () => {
    const res = await api.put("/api/roles/permissions").set("Cookie", editor).send({ roles: {} });
    expect(res.status).toBe(403);
  });

  it("removing a permission takes effect on the next request", async () => {
    const save = await api
      .put("/api/roles/permissions")
      .set("Cookie", superAdmin)
      .send({ roles: { editor: ["hero.view"] } });
    expect(save.status).toBe(200);

    const res = await api.put("/api/hero/stats").set("Cookie", editor).send({ stats: [] });
    expect(res.status).toBe(403);
  });
});

describe("first admin", () => {
  it("creates the account once, and promotes only that account", async () => {
    await User.deleteMany({});
    process.env.ADMIN_EMAIL = "Owner@Test.invalid";
    process.env.ADMIN_PASSWORD = PASSWORD;
    await User.create({ email: "other@test.invalid", password: PASSWORD, role: "editor" });

    await seedAdmin();
    expect((await User.findOne({ email: "owner@test.invalid" }))?.role).toBe("super_admin");

    await User.updateOne({ email: "owner@test.invalid" }, { role: "editor" });
    await seedAdmin();
    expect((await User.findOne({ email: "owner@test.invalid" }))?.role).toBe("super_admin");
    expect((await User.findOne({ email: "other@test.invalid" }))?.role).toBe("editor");

    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });
});
