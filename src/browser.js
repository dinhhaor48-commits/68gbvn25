const { chromium } = require("playwright");
const { INJECT_SCRIPT } = require("./parser");

const GAME_URL = process.env.GAME_URL || "https://68gbvn88.bar/";

let page = null;

async function clickCanvas(p, x, y, label) {
  const canvas = await p.waitForSelector('canvas#GameCanvas', { timeout: 20000 });
  const box = await canvas.boundingBox();
  await p.mouse.click(box.x + x, box.y + y);
  console.log(`[Browser] Đã click ${label} tại (${x}, ${y})`);
}

async function navigateToGame(p) {
  // Chỉ cần chờ canvas load - WebSocket đã connect từ trang chủ
  await p.waitForSelector('canvas#GameCanvas', { timeout: 20000 });
  await p.waitForFunction(() => {
    const c = document.querySelector('canvas#GameCanvas');
    return c && c.offsetWidth > 500;
  }, { timeout: 30000, polling: 500 });
  console.log("[Browser] Trang đã load, WebSocket đang lắng nghe kết quả...");
}

async function startBrowser() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  page = await context.newPage();

  // Expose function TRƯỚC khi inject script và load trang
  await page.exposeFunction('__reportResult', (entry) => {
    console.log(`[KẾT QUẢ] Phiên #${entry.period} | 🎲 ${entry.dice.join('-')} | Tổng ${entry.sum} | ${entry.result}`);
    if (!page.__taixiu_results) page.__taixiu_results = [];
    page.__taixiu_results.unshift(entry);
    if (page.__taixiu_results.length > 100) page.__taixiu_results.pop();
  });

  // Inject script trước khi trang load
  await context.addInitScript(INJECT_SCRIPT);

  // Forward tất cả console từ browser ra terminal để debug
  page.on('console', msg => {
    if (msg.text().startsWith('[INJECT')) {
      console.log('[BROWSER]', msg.text());
    }
  });

  console.log(`[Browser] Đang mở: ${GAME_URL}`);
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });

  await navigateToGame(page);

  // Giữ browser sống, reconnect nếu crash
  page.on("crash", async () => {
    console.error("[Browser] Page crash, đang restart...");
    await startBrowser();
  });
}

async function getResults() {
  if (!page) return [];
  return page.__taixiu_results || [];
}

module.exports = { startBrowser, getResults };
