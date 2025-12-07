// ktmb_scraper.js
import puppeteer from "puppeteer";
import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function bold(text) {
  return `*${text}*`;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto("https://online.ktmb.com.my/Trip", { waitUntil: "networkidle2" });

  await page.select("#FromStationId", "19100");
  await page.select("#ToStationId", "42400");

  await page.click("#OnwardDate");
  await page.waitForSelector(".lightpick");

  await page.select(".lightpick__select-years", "2026");
  await page.select(".lightpick__select-months", "2");

  const daySelector = '.lightpick__day.is-available:not(.is-previous-month):not(.is-next-month)';
  await page.waitForSelector(daySelector);

  const days = await page.$$(daySelector);
  for (const d of days) {
    const text = await page.evaluate(el => el.textContent.trim(), d);
    if (text === "24") {
      await d.click();
      break;
    }
  }

  await page.click(".picker-btn");

  await page.waitForSelector("#btnSubmit", { visible: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await new Promise(r => setTimeout(r, 300));
  await page.click("#btnSubmit");

  await page.waitForSelector(".depart-trips tr");

  const trains = await page.evaluate(() => {
    const rows = document.querySelectorAll(".depart-trips tr");
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll("td");
      return {
        train: cells[0]?.innerText.trim() || "",
        departure: cells[1]?.innerText.trim() || "",
        arrival: cells[2]?.innerText.trim() || "",
        duration: cells[3]?.innerText.replace(/\s+/g, " ").trim() || "",
        seats: cells[4]?.childNodes[1]?.nodeValue.trim() || "",
        fare: cells[5]?.innerText.trim() || "",
      };
    });
  });

  await browser.close();

  let msg = `🚂 *Trains KL Sentral → Gurun*\n\n`;

  trains.forEach(t => {
    msg += `📌 Train: *${t.train}*\n⏱ ${t.departure} → ${t.arrival}\n🕒 ${t.duration}\n💺 Seats: ${bold(t.seats)}\n💵 RM ${t.fare}\n\n`;
  });

  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: "Markdown"
  });

})();
