const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto("https://68gbvn88.bar/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "screenshot-home.png", fullPage: true });
  console.log("Saved: screenshot-home.png");

  // In ra tất cả các element có thể click được
  const clickables = await page.evaluate(() => {
    const els = document.querySelectorAll("a, button, [onclick], img, canvas, div[class]");
    return Array.from(els).slice(0, 50).map(el => ({
      tag: el.tagName,
      class: el.className?.toString().slice(0, 80),
      text: el.innerText?.slice(0, 50),
      src: el.src || null,
    }));
  });

  console.log(JSON.stringify(clickables, null, 2));

  await browser.close();
})();
