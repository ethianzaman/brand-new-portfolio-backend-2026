import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cloudinary } from "../../src/lib/cloudinary";
import { User } from "../../src/models/User";
import { api, signIn } from "../support/helpers";

const PNG = Buffer.from("fake image, Cloudinary is faked in tests");
const png = (name: string) => ({ filename: name, contentType: "image/png" });

describe("project case study and screenshots", () => {
  let cookie: string;
  const destroy = vi.spyOn(cloudinary.uploader, "destroy");

  beforeAll(async () => {
    await User.deleteMany({});
    cookie = await signIn();
  });
  afterEach(() => destroy.mockClear());

  const create = () =>
    api
      .post("/api/projects/create")
      .set("Cookie", cookie)
      .field("title", `Case Study ${Date.now()}`)
      .field("description", "Short summary")
      .field("category", "fullstack")
      .field("liveUrl", "https://example.com")
      .field("githubUrl", "https://github.com/x/y")
      .field("goal", "Help people book rooms")
      .field("features", JSON.stringify(["Search", "Payments", " "]))
      .field("approach", "Next.js and Express")
      .field("challenges", "Double bookings")
      .field("outcome", "Live with 200 users")
      .field("role", "Full-stack")
      .field("year", "2025")
      .field("status", "live")
      .attach("gallery", PNG, png("one.png"))
      .attach("gallery", PNG, png("two.png"));

  it("saves every case study field and the screenshots in order", async () => {
    const res = await create();
    expect(res.status, JSON.stringify(res.body)).toBe(201);

    const { project } = res.body;
    expect(project).toMatchObject({
      goal: "Help people book rooms",
      features: ["Search", "Payments"],
      approach: "Next.js and Express",
      challenges: "Double bookings",
      outcome: "Live with 200 users",
      role: "Full-stack",
      year: "2025",
      status: "live",
    });
    expect(project.gallery).toHaveLength(2);
    for (const url of project.gallery) expect(url).toMatch(/\/portfolio\/projects\/gallery\//);

    // The public detail page reads the same fields.
    const page = await api.get(`/api/projects/slug/${project.slug}`);
    expect(page.body.project.gallery).toEqual(project.gallery);
    expect(page.body.project.features).toEqual(["Search", "Payments"]);
  });

  it("keeps, removes and adds screenshots, and deletes only what was dropped", async () => {
    const { project } = (await create()).body;
    const [first, second] = project.gallery;

    const res = await api
      .put(`/api/projects/${project.id}`)
      .set("Cookie", cookie)
      .field("gallery", JSON.stringify([first]))
      .attach("gallery", PNG, png("three.png"));
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const gallery: string[] = res.body.project.gallery;
    expect(gallery[0]).toBe(first);
    expect(gallery).toHaveLength(2);
    expect(gallery).not.toContain(second);

    const removed = destroy.mock.calls.map(([id]) => id);
    expect(removed).toHaveLength(1);
    expect(second).toContain(removed[0]);
  });

  it("leaves the screenshots alone when an edit doesn't mention them", async () => {
    const { project } = (await create()).body;
    const res = await api
      .put(`/api/projects/${project.id}`)
      .set("Cookie", cookie)
      .field("goal", "")
      .field("features", "One\nTwo\n");
    expect(res.status).toBe(200);
    expect(res.body.project.gallery).toEqual(project.gallery);
    expect(res.body.project.goal).toBe("");
    expect(res.body.project.features).toEqual(["One", "Two"]);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("rejects bad input before anything is uploaded", async () => {
    const { project } = (await create()).body;
    const put = () => api.put(`/api/projects/${project.id}`).set("Cookie", cookie);

    const tooMany = put().field("gallery", JSON.stringify(project.gallery));
    for (let i = 0; i < 7; i += 1) tooMany.attach("gallery", PNG, png(`n${i}.png`));
    const many = await tooMany;
    expect(many.status).toBe(400);
    expect(many.body.message).toMatch(/Up to 8 screenshots/);

    const unsafe = await put().field("gallery", JSON.stringify(["javascript:alert(1)"]));
    expect(unsafe.status).toBe(400);

    const status = await put().field("status", "finished");
    expect(status.status).toBe(400);

    const long = await put().field("role", "x".repeat(81));
    expect(long.status).toBe(400);

    const after = await api.get(`/api/projects/slug/${project.slug}`);
    expect(after.body.project.gallery).toEqual(project.gallery);
  });

  it("card images: the first is the thumbnail, and the form's order wins", async () => {
    const created = await api
      .post("/api/projects/create")
      .set("Cookie", cookie)
      .field("title", `Cards ${Date.now()}`)
      .field("description", "d")
      .field("category", "frontend")
      .field("cardImages", JSON.stringify(["upload:1", "upload:0"]))
      .attach("cardImages", PNG, png("a.png"))
      .attach("cardImages", PNG, png("b.png"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const { project } = created.body;
    expect(project.thumbnail).toMatch(/\/portfolio\/projects\//);
    expect(project.images).toHaveLength(1);
    const [first, second] = [project.thumbnail, project.images[0]];

    // Move the second image to the front and replace the old front one.
    const res = await api
      .put(`/api/projects/${project.id}`)
      .set("Cookie", cookie)
      .field("cardImages", JSON.stringify([second, "upload:0"]))
      .attach("cardImages", PNG, png("c.png"));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.project.thumbnail).toBe(second);
    expect(res.body.project.images).toHaveLength(1);
    expect(res.body.project.images[0]).not.toBe(first);

    const removed = destroy.mock.calls.map(([id]) => id);
    expect(removed).toHaveLength(1);
    expect(first).toContain(removed[0]);
  });

  it("clearing the card images leaves the project without a thumbnail", async () => {
    const { project } = (await create()).body;
    const withCards = await api
      .put(`/api/projects/${project.id}`)
      .set("Cookie", cookie)
      .attach("cardImages", PNG, png("x.png"));
    expect(withCards.body.project.thumbnail).toBeTruthy();

    const cleared = await api.put(`/api/projects/${project.id}`).set("Cookie", cookie).field("cardImages", "[]");
    expect(cleared.status).toBe(200);
    expect(cleared.body.project.thumbnail).toBe("");
    expect(cleared.body.project.images).toEqual([]);
  });

  it("rejects a fifth card image or an unknown upload before uploading", async () => {
    const { project } = (await create()).body;
    const five = api.put(`/api/projects/${project.id}`).set("Cookie", cookie);
    for (let i = 0; i < 5; i += 1) five.attach("cardImages", PNG, png(`f${i}.png`));
    const tooMany = await five;
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toBe("Too many files for cardImages");

    const ghost = await api
      .put(`/api/projects/${project.id}`)
      .set("Cookie", cookie)
      .field("cardImages", JSON.stringify(["upload:3"]));
    expect(ghost.status).toBe(400);
  });

  it("a project that fails to save takes its new uploads with it", async () => {
    const res = await api
      .post("/api/projects/create")
      .set("Cookie", cookie)
      .field("title", `Broken ${Date.now()}`)
      .field("description", "d")
      .field("category", "not-a-category")
      .attach("cardImages", PNG, png("lost.png"))
      .attach("gallery", PNG, png("lost2.png"));
    expect(res.status).toBe(400);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it("deleting a project removes its screenshots too", async () => {
    const { project } = (await create()).body;
    const res = await api.delete(`/api/projects/${project.id}`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const removed = destroy.mock.calls.map(([id]) => id);
    for (const url of project.gallery) {
      expect(removed.some((id) => url.includes(id))).toBe(true);
    }
  });
});
