// scripts/thm-scrape.mjs
// Scrapes the public TryHackMe profile page and writes data/thm-data.json
// + a screenshot of the official badge iframe (always-reliable fallback).

import { chromium } from 'playwright';
import fs from 'fs';

const USERNAME = process.env.THM_USERNAME || 'Hackth3Path';
const USER_PUBLIC_ID = process.env.THM_USER_PUBLIC_ID || '68bec025528d80e31cd92fb6';
const PROFILE_URL = `https://tryhackme.com/p/${USERNAME}`;
const BADGE_URL = `https://tryhackme.com/api/v2/badges/public-profile?userPublicId=${USER_PUBLIC_ID}`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  });

  // 1) Official badge screenshot — reliable, always works.
  const badgePage = await context.newPage();
  await badgePage.setViewportSize({ width: 340, height: 100 });
  await badgePage.goto(BADGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  fs.mkdirSync('assets', { recursive: true });
  await badgePage.screenshot({ path: 'assets/thm_badge.png' });
  await badgePage.close();

  // 2) Best-effort text scrape of the public profile page — updated selectors 2026-09.
  const page = await context.newPage();
  let data = {
    username: USERNAME,
    rank: null,
    level: null,
    badgeCount: null,
    completedRooms: [],
    updatedAt: new Date().toISOString()
  };

  try {
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(6000);

    const extracted = await page.evaluate(() => {
      // stats wrapper: "top 3%\nRank\n68137\nBadges\n16\nStreak\n0\nCompleted rooms\n141"
      const wrapper = document.querySelector('[class*="StyledStatisticsWrapper"]');
      const wrapperText = wrapper ? wrapper.innerText : document.body.innerText;
      const lines = wrapperText.split('\n').map(s => s.trim()).filter(Boolean);
      let rank = null, badgeCount = null, completedCount = null, level = null;

      for (let i = 0; i < lines.length; i++) {
        if (/^rank$/i.test(lines[i])) {
          // lines[i-1] = "top 3%", lines[i+1] = "68137"
          const percentile = lines[i - 1] || '';
          const num = lines[i + 1] || '';
          if (percentile && num) rank = `${num} (${percentile})`;
          else rank = percentile || num || null;
        }
        if (/^badges$/i.test(lines[i]) && i + 1 < lines.length) badgeCount = lines[i + 1];
        if (/^completed rooms$/i.test(lines[i]) && i + 1 < lines.length) completedCount = lines[i + 1];
      }

      // level is the big number before username in header (e.g., "64\nHackth3Path")
      const bodyText = document.body.innerText;
      const m = bodyText.match(/\b(\d{1,3})\b\s*\n\s*Hackth3Path/);
      if (m) level = m[1];
      // fallback: look for element containing level number near avatar
      if (!level) {
        const lvl = document.querySelector('[class*="level" i]');
        if (lvl) level = lvl.innerText.trim();
      }

      // completed room titles from grid (first page, up to 8-16 visible)
      const roomTitles = [];
      const grid = document.querySelector('[class*="StyledRoomsGrid"]');
      if (grid) {
        const hs = grid.querySelectorAll('h2');
        hs.forEach(h => {
          const t = h.innerText.trim();
          if (t && !roomTitles.includes(t)) roomTitles.push(t);
        });
      }
      // fallback: any h2 under tabs
      if (roomTitles.length === 0) {
        document.querySelectorAll('h2').forEach(h => {
          const t = h.innerText.trim();
          if (t.length > 2 && t.length < 80 && !/TryHackMe|Continue|Learning/i.test(t)) roomTitles.push(t);
        });
      }

      return { rank, badgeCount: badgeCount ? parseInt(badgeCount, 10) : null, completedCount: completedCount ? parseInt(completedCount, 10) : null, level, roomTitles: roomTitles.slice(0, 20), lines, wrapperText };
    });

    console.log('[thm-scrape] evaluate:', extracted);

    if (extracted.rank) data.rank = extracted.rank;
    if (extracted.level) data.level = extracted.level;
    if (extracted.badgeCount) data.badgeCount = extracted.badgeCount;
    if (extracted.roomTitles && extracted.roomTitles.length) data.completedRooms = extracted.roomTitles.slice(0, 10);
    // if no titles but count exists, at least note count in rooms or keep empty — rooms list will be used as display
    if (data.completedRooms.length === 0 && extracted.completedCount) {
      data.completedRooms = [`${extracted.completedCount} rooms completed — see profile for full list`];
    }
  } catch (e) {
    console.error('[thm-scrape] Text scrape failed (page structure may differ):', e.message);
  }

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/thm-data.json', JSON.stringify(data, null, 2));
  console.log('[thm-scrape] Wrote data/thm-data.json:', data);

  await browser.close();
}

main();
