import { beforeAll, describe, expect, it } from "vitest";
import { api, contract, signIn } from "../support/helpers";

const PNG = Buffer.from("not really a png, Cloudinary is faked in tests");

/**
 * Pins what every endpoint sends back, status and body, in a snapshot. The API
 * is what the frontend depends on, so a refactor must leave these untouched.
 * A snapshot diff means the API changed: fix the code, or if the change is
 * intended, update the snapshot and the frontend together.
 */
describe("API contract", () => {
  let cookie: string;

  const as = () => ({ Cookie: cookie });
  const pin = (res: Parameters<typeof contract>[0], name: string) =>
    expect(contract(res)).toMatchSnapshot(name);

  beforeAll(async () => {
    cookie = await signIn();
  });

  it("health", async () => {
    pin(await api.get("/api/health"), "ok");
    pin(await api.get("/api/home"), "the old home path is gone");
  });

  it("hero", async () => {
    pin(await api.get("/api/hero"), "default");
    pin(await api.put("/api/hero"), "write needs a session");

    pin(
      await api
        .put("/api/hero")
        .set(as())
        .field("name", "Test Name")
        .field("title", "Engineer")
        .field("bio", "Bio")
        .field("titles", JSON.stringify(["One", "Two"]))
        .field("socials", JSON.stringify([{ label: "GitHub", href: "https://github.com/x" }]))
        .attach("image", PNG, { filename: "me.png", contentType: "image/png" }),
      "update with an image",
    );
    pin(await api.put("/api/hero").set(as()).field("name", ""), "update with an empty name");
    pin(
      await api.put("/api/hero").set(as()).field("resumeUrl", "javascript:alert(1)"),
      "unsafe resume link",
    );

    pin(
      await api
        .put("/api/hero/stats")
        .set(as())
        .send({ stats: [{ value: "2+", label: "Years" }] }),
      "replace stats",
    );
    pin(await api.put("/api/hero/stats").set(as()).send({ stats: "nope" }), "bad stats");
    const created = await api
      .post("/api/hero/stats")
      .set(as())
      .send({ value: "9+", label: "Projects" });
    pin(created, "add a stat");
    const statId = created.body.stat?.id ?? created.body.stat?._id;
    pin(
      await api.put(`/api/hero/stats/${statId}`).set(as()).send({ value: "10+" }),
      "edit a stat",
    );
    pin(await api.delete(`/api/hero/stats/${statId}`).set(as()), "delete a stat");
    pin(
      await api.delete("/api/hero/stats/64b000000000000000000000").set(as()),
      "delete a missing stat",
    );
    pin(await api.get("/api/hero"), "after the edits");
  });

  it("projects", async () => {
    const body = {
      title: "My Project",
      description: "A project",
      category: "fullstack",
      tags: ["react"],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/x/y",
      color: "#123456",
    };
    pin(await api.get("/api/projects"), "public list, empty");
    pin(await api.post("/api/projects/create").send(body), "create needs a session");
    pin(await api.get("/api/projects/all"), "dashboard list needs a session");
    pin(
      await api.post("/api/projects/create").set(as()).send({ ...body, liveUrl: "javascript:x" }),
      "unsafe link",
    );
    pin(await api.post("/api/projects/create").set(as()).send({ title: "Only" }), "missing fields");

    const created = await api.post("/api/projects/create").set(as()).send(body);
    pin(created, "create");
    const id = created.body.project.id ?? created.body.project._id;
    pin(await api.post("/api/projects/create").set(as()).send(body), "same title, new slug");

    pin(await api.get("/api/projects?pageSize=1"), "public list, paged");
    pin(await api.get("/api/projects/all?q=project&sort=title&dir=asc").set(as()), "dashboard list");
    pin(await api.get("/api/projects/stats").set(as()), "stats");
    pin(await api.get("/api/projects/slug/my-project"), "by slug");
    pin(await api.get("/api/projects/slug/none"), "missing slug");
    pin(await api.get(`/api/projects/${id}`).set(as()), "by id");
    pin(
      await api
        .put(`/api/projects/${id}`)
        .set(as())
        .field("title", "Renamed")
        .field("featured", "true")
        .attach("image", PNG, { filename: "p.png", contentType: "image/png" }),
      "update keeps the slug",
    );
    pin(
      await api.put(`/api/projects/${id}`).set(as()).send({ seo: { canonicalUrl: "http://x" } }),
      "bad seo",
    );
    pin(await api.delete(`/api/projects/${id}`).set(as()), "delete");
    pin(await api.delete(`/api/projects/${id}`).set(as()), "delete twice");
  });

  it("blogs", async () => {
    const body = {
      title: "My Post",
      excerpt: "Short",
      content: "Long content",
      category: "tech",
      tags: ["node"],
      author: "Me",
      status: "published",
    };
    pin(await api.get("/api/blogs"), "public list, empty");
    pin(await api.post("/api/blogs/create").send(body), "create needs a session");
    pin(await api.post("/api/blogs/create").set(as()).send({}), "missing fields");

    const created = await api.post("/api/blogs/create").set(as()).send(body);
    pin(created, "create");
    const id = created.body.blog?.id ?? created.body.blog?._id;
    pin(await api.get("/api/blogs"), "public list");
    pin(await api.get("/api/blogs/all").set(as()), "dashboard list");
    pin(await api.get("/api/blogs/stats").set(as()), "stats");
    pin(await api.get("/api/blogs/slug/my-post"), "by slug");
    pin(await api.get("/api/blogs/slug/none"), "missing slug");
    pin(await api.get(`/api/blogs/${id}`), "by id");
    pin(await api.put(`/api/blogs/${id}`).set(as()).send({ title: "Renamed" }), "update");
    pin(await api.delete(`/api/blogs/${id}`).set(as()), "delete");
    pin(await api.delete(`/api/blogs/${id}`).set(as()), "delete twice");
  });

  it("services", async () => {
    const body = {
      icon: "Code2",
      title: "Web Development",
      description: "Sites",
      features: [{ text: "Fast" }],
      tags: ["web"],
    };
    pin(await api.get("/api/services"), "public list, empty");
    pin(await api.post("/api/services/create").send(body), "create needs a session");
    pin(await api.post("/api/services/create").set(as()).send({}), "missing fields");

    const created = await api.post("/api/services/create").set(as()).send(body);
    pin(created, "create");
    const id = created.body.service?.id ?? created.body.service?._id;
    pin(await api.get("/api/services"), "public list");
    pin(await api.get("/api/services/stats").set(as()), "stats");
    pin(await api.get("/api/services/slug/web-development"), "by slug");
    pin(await api.get("/api/services/slug/none"), "missing slug");
    pin(await api.put(`/api/services/${id}`).set(as()).send({ title: "Renamed" }), "update");
    pin(await api.delete(`/api/services/${id}`).set(as()), "delete");
    pin(await api.delete(`/api/services/${id}`).set(as()), "delete twice");
  });

  it("skills", async () => {
    pin(await api.get("/api/skills"), "public list, empty");
    pin(await api.post("/api/skills/categories").send({ label: "Web" }), "create needs a session");
    pin(await api.post("/api/skills/categories").set(as()).send({}), "missing label");

    const created = await api.post("/api/skills/categories").set(as()).send({ label: "Web" });
    pin(created, "create a category");
    const id = created.body.category?.id ?? created.body.category?._id;
    const other = await api.post("/api/skills/categories").set(as()).send({ label: "Data" });
    const otherId = other.body.category?.id ?? other.body.category?._id;

    pin(await api.put(`/api/skills/categories/${id}`).set(as()).send({ label: "Frontend" }), "rename");
    pin(
      await api.post(`/api/skills/categories/${id}/skills`).set(as()).send({ name: "React", icon: "Code2" }),
      "add a skill",
    );
    pin(
      await api.post(`/api/skills/categories/${id}/skills`).set(as()).send({ name: "React", icon: "Code2" }),
      "add the same skill",
    );
    pin(
      await api.put(`/api/skills/categories/${id}/skills/React`).set(as()).send({ name: "Next" }),
      "edit a skill",
    );
    pin(
      await api
        .put(`/api/skills/categories/${id}/skills/Next`)
        .set(as())
        .send({ targetCategoryId: otherId }),
      "move a skill",
    );
    pin(await api.get("/api/skills"), "public list");
    pin(await api.delete(`/api/skills/categories/${otherId}/skills/Next`).set(as()), "delete a skill");
    pin(await api.delete(`/api/skills/categories/${id}`).set(as()), "delete a category");
  });

  it("about", async () => {
    pin(await api.get("/api/about"), "default");
    pin(await api.put("/api/about/hero").field("name", "x"), "write needs a session");
    pin(
      await api
        .put("/api/about/hero")
        .set(as())
        .field("name", "Test")
        .field("title", "Engineer")
        .attach("resume", PNG, { filename: "cv.png", contentType: "image/png" }),
      "resume must be a pdf",
    );
    pin(
      await api
        .put("/api/about/hero")
        .set(as())
        .field("name", "Test")
        .field("title", "Engineer")
        .attach("resume", Buffer.from("%PDF-1.4"), { filename: "cv.pdf", contentType: "application/pdf" }),
      "update with a resume",
    );

    const section = async (path: string, key: string, body: object, edit: object) => {
      const made = await api.post(`/api/about/${path}`).set(as()).send(body);
      pin(made, `${path} add`);
      pin(await api.post(`/api/about/${path}`).set(as()).send({}), `${path} missing fields`);
      const item = made.body[key] ?? made.body;
      const id = item.id ?? item._id;
      pin(await api.put(`/api/about/${path}/${id}`).set(as()).send(edit), `${path} edit`);
      pin(await api.delete(`/api/about/${path}/${id}`).set(as()), `${path} delete`);
    };
    await section(
      "experiences",
      "experience",
      { role: "Dev", company: "Co", period: "2020", description: "Built", tags: ["x"] },
      { role: "Lead" },
    );
    await section(
      "educations",
      "education",
      { degree: "BSc", school: "Uni", period: "2019", description: "Studied" },
      { degree: "MSc" },
    );
    await section("values", "value", { icon: "Zap", title: "Fast", desc: "Quick" }, { title: "Faster" });
  });

  it("contact", async () => {
    pin(await api.get("/api/contact"), "default");
    pin(await api.put("/api/contact/info").send({ email: "a@b.co" }), "write needs a session");
    pin(
      await api.put("/api/contact/info").set(as()).send({ email: "a@b.co", phone: "1", location: "Dhaka" }),
      "update info",
    );
    pin(
      await api.put("/api/contact/form-options").set(as()).send({ services: ["Web"], budgets: ["$100"] }),
      "update form options",
    );
    pin(await api.put("/api/contact/form-options").set(as()).send({ services: "x" }), "bad form options");
    pin(await api.post("/api/contact/faq").set(as()).send({}), "faq missing fields");
    const faq = await api.post("/api/contact/faq").set(as()).send({ question: "Q?", answer: "A" });
    pin(faq, "add a faq");
    const id = faq.body.faq?.id ?? faq.body.faq?._id;
    pin(await api.put(`/api/contact/faq/${id}`).set(as()).send({ question: "Q2?", answer: "A2" }), "edit a faq");
    pin(await api.delete(`/api/contact/faq/${id}`).set(as()), "delete a faq");
    pin(await api.delete("/api/contact/faq/64b000000000000000000000").set(as()), "delete a missing faq");
  });

  it("messages and leads", async () => {
    const message = { name: "Visitor", email: "v@test.invalid", subject: "Hi", budget: "$100", message: "Hello" };
    pin(await api.post("/api/messages").send({}), "missing fields");
    const sent = await api.post("/api/messages").send(message);
    pin(sent, "contact form");
    pin(await api.get("/api/messages"), "inbox needs a session");
    const list = await api.get("/api/messages").set(as());
    pin(list, "inbox");
    const id = list.body.messages?.[0]?.id ?? list.body.messages?.[0]?._id;
    pin(await api.get("/api/messages/unread-count").set(as()), "unread count");
    pin(await api.get(`/api/messages/${id}`).set(as()), "read one");
    pin(await api.patch(`/api/messages/${id}`).set(as()).send({ starred: true }), "star");
    pin(await api.patch(`/api/messages/${id}`).set(as()).send({ status: "nonsense" }), "bad status");
    pin(await api.post(`/api/messages/${id}/reply`).set(as()).send({}), "empty reply");
    pin(await api.post(`/api/messages/${id}/reply`).set(as()).send({ body: "Thanks" }), "reply without mail set up");
    pin(await api.post("/api/messages/read-all").set(as()), "read all");

    pin(await api.get("/api/leads"), "leads need a session");
    const leads = await api.get("/api/leads").set(as());
    pin(leads, "leads");
    const leadId = leads.body.leads?.[0]?.id ?? leads.body.leads?.[0]?._id;
    pin(await api.get(`/api/leads/${leadId}`).set(as()), "one lead");
    pin(await api.post(`/api/leads/${leadId}/read`).set(as()), "mark lead read");

    pin(await api.delete(`/api/leads/${leadId}`).set(as()), "delete a lead");
    pin(await api.delete(`/api/leads/${leadId}`).set(as()), "delete a lead twice");
    pin(await api.delete(`/api/messages/${id}`).set(as()), "delete a message");
  });

  it("settings", async () => {
    pin(await api.get("/api/settings"), "default");
    pin(await api.get("/api/settings/pages/seo"), "page seo, default");
    pin(await api.put("/api/settings/seo").send({}), "write needs a session");
    pin(
      await api.put("/api/settings/brand").set(as()).field("name", "Brand").field("tagline", "Line"),
      "update brand",
    );
    pin(await api.post("/api/settings/socials/setup").set(as()), "socials setup");
    pin(await api.post("/api/settings/socials").set(as()).send({}), "social missing fields");
    const social = await api
      .post("/api/settings/socials")
      .set(as())
      .send({ label: "GitHub", href: "https://github.com/x", icon: "github", iconType: "icon" });
    pin(social, "add a social");
    const id = social.body.settings?.socials?.at(-1)?.id;
    pin(
      await api
        .put(`/api/settings/socials/${id}`)
        .set(as())
        .send({ label: "Code", href: "https://github.com/y", icon: "github", iconType: "icon" }),
      "edit a social",
    );
    pin(
      await api.put("/api/settings/social-placements").set(as()).send({ placements: { footer: [id] } }),
      "placements",
    );
    pin(await api.delete(`/api/settings/socials/${id}`).set(as()), "delete a social");
    pin(await api.put("/api/settings/seo").set(as()).send({ metaTitle: "Site" }), "site seo");
    pin(await api.put("/api/settings/pages/seo/home").set(as()).send({ metaTitle: "Landing" }), "page seo");
    pin(await api.put("/api/settings/pages/seo/nope").set(as()).send({ metaTitle: "x" }), "unknown page");
    pin(await api.post("/api/settings/og-image").set(as()), "og image without a file");
    pin(
      await api
        .post("/api/settings/og-image")
        .set(as())
        .attach("image", PNG, { filename: "og.png", contentType: "image/png" }),
      "og image",
    );
  });

  it("users and roles", async () => {
    pin(await api.get("/api/users"), "users need a session");
    pin(await api.post("/api/users").set(as()).send({ email: "nope", role: "editor" }), "bad email");
    const created = await api
      .post("/api/users")
      .set(as())
      .send({ email: "editor@test.invalid", role: "editor", password: "Str0ng-Test-Pass-77!" });
    pin(created, "create");
    const id = created.body.user?.id ?? created.body.user?._id;
    pin(await api.get("/api/users").set(as()), "list");
    pin(await api.patch(`/api/users/${id}/role`).set(as()).send({ role: "manager" }), "change role");
    pin(await api.patch(`/api/users/${id}/role`).set(as()).send({ role: "king" }), "bad role");
    pin(await api.patch(`/api/users/${id}/status`).set(as()).send({ isActive: false }), "disable");
    pin(await api.post(`/api/users/${id}/reset-password`).set(as()), "reset password");
    pin(await api.delete(`/api/users/${id}`).set(as()), "delete");

    pin(await api.get("/api/roles/permissions"), "roles need a session");
    pin(await api.get("/api/roles/permissions").set(as()), "role config");
    pin(
      await api.put("/api/roles/permissions").set(as()).send({ roles: { editor: ["hero.view"] } }),
      "save role config",
    );
  });
});
