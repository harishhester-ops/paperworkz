import { chromium } from "playwright-core";

const BASE = "http://localhost:3456";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Debug homepage links
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const hrefs = await page.$$eval("a[href]", els => els.map(e => e.getAttribute("href")));
  console.log("All hrefs on homepage:", hrefs.filter(h => ["/pdf-to-jpg","/jpg-to-pdf","/n-up","/remove-annotations"].includes(h)));

  // Debug remove-annotations page
  await page.goto(`${BASE}/remove-annotations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const html = await page.content();
  console.log("\n/remove-annotations has input[type=file]:", html.includes('type="file"') || html.includes("type='file'"));
  console.log("Has label:", html.includes("<label"));
  console.log("Body snippet:", html.substring(html.indexOf("<body"), html.indexOf("<body") + 500));

  await browser.close();
})();
