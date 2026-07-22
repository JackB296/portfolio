import { expect, test, type Page } from "@playwright/test";

async function jsonLd(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block));
}

test("sitemap publishes stable modification dates for indexable routes", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();

  const sitemap = await response.text();
  expect(sitemap).toMatch(
    /<loc>https:\/\/jbialecki\.com<\/loc>\s*<lastmod>2026-07-20T00:00:00.000Z<\/lastmod>/
  );
  expect(sitemap).toMatch(
    /<loc>https:\/\/jbialecki\.com\/resume<\/loc>\s*<lastmod>2026-07-19T00:00:00.000Z<\/lastmod>/
  );
  expect(sitemap).toMatch(
    /<loc>https:\/\/jbialecki\.com\/work\/voyage-foods-dashboard<\/loc>\s*<lastmod>2026-07-20T00:00:00.000Z<\/lastmod>/
  );
  expect(sitemap).toMatch(
    /<loc>https:\/\/jbialecki\.com\/flappy<\/loc>\s*<lastmod>2026-07-20T00:00:00.000Z<\/lastmod>/
  );
});

test("homepage identifies itself as Jackson Bialecki's profile page", async ({
  page,
}) => {
  await page.goto("/");
  const blocks = await jsonLd(page);
  const profilePage = blocks.find((block) => block["@type"] === "ProfilePage");

  expect(profilePage).toMatchObject({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: "https://jbialecki.com",
    mainEntity: {
      "@type": "Person",
      name: "Jackson Bialecki",
      url: "https://jbialecki.com",
    },
  });
});

test("case studies publish TechArticle structured data", async ({ page }) => {
  await page.goto("/work/voyage-foods-dashboard");
  const blocks = await jsonLd(page);
  const article = blocks.find((block) => block["@type"] === "TechArticle");

  expect(article).toMatchObject({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "One dashboard for the plant floor: ERP, QA, and 200+ live SCADA tags",
    url: "https://jbialecki.com/work/voyage-foods-dashboard",
    dateModified: "2026-07-20",
    author: {
      "@type": "Person",
      name: "Jackson Bialecki",
    },
  });
});

test("interactive demos publish SoftwareApplication structured data", async ({
  page,
}) => {
  await page.goto("/raycaster");
  const blocks = await jsonLd(page);
  const application = blocks.find(
    (block) => block["@type"] === "SoftwareApplication"
  );

  expect(application).toMatchObject({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Raycasting Engine",
    url: "https://jbialecki.com/raycaster",
    dateModified: "2026-07-20",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any modern web browser",
  });
});
