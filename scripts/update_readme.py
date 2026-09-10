#!/usr/bin/env python3
"""
Fetch TryHackMe public profile stats using userPublicId.
"""

import re
import sys
import json
import time
import requests
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────
# ⚠️ تم وضع userPublicId الخاص بك هنا
THM_USER_PUBLIC_ID = "68bec025528d80e31cd92fb6"
README_PATH = Path("README.md")

# استخدام userPublicId في نقاط النهاية
THM_PROFILE_URL = f"https://tryhackme.com/api/v2/badges/public-profile?userPublicId={THM_USER_PUBLIC_ID}"
THM_BADGES_URL = f"https://tryhackme.com/api/v2/badges/public-profile?userPublicId={THM_USER_PUBLIC_ID}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

def fetch_json(url, max_retries=3):
    """
    Fetch JSON from a URL with retry and exponential backoff for 429 errors.
    """
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                wait_time = (2 ** attempt) * 5  # 5s, 10s, 20s
                print(f"⏳ Rate limited. Waiting {wait_time}s before retry {attempt + 1}/{max_retries}...")
                time.sleep(wait_time)
            else:
                print(f"⚠️ HTTP error for {url}: {e}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Request failed for {url}: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON decode failed for {url}: {e}")
            return None
    print(f"❌ Failed to fetch {url} after {max_retries} attempts")
    return None

def get_profile_stats():
    data = fetch_json(THM_PROFILE_URL)
    if not data:
        return None

    # userPublicId endpoint يعيد البيانات مباشرة أو داخل "data"
    user = data.get("data", {}) or data
    
    # محاولة استخراج البيانات من هيكل الرد
    stats = {
        "rank": user.get("rank") or user.get("ranking") or "N/A",
        "badges": user.get("badges") or user.get("badgeCount") or "N/A",
        "streak": user.get("streak") or user.get("streakCount") or "N/A",
        "completed_rooms": (
            user.get("completedRooms")
            or user.get("completed_rooms")
            or user.get("roomsCompleted")
            or "N/A"
        ),
    }
    return stats

def format_stats_table(stats):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows = [
        ("🏅 Rank", stats.get("rank", "N/A")),
        ("🎖️ Badges", stats.get("badges", "N/A")),
        ("🔥 Streak", stats.get("streak", "N/A")),
        ("🚪 Completed Rooms", stats.get("completed_rooms", "N/A")),
        ("📅 Last Updated", timestamp),
    ]
    lines = ["| Stat | Value |", "|------|-------|"]
    for label, value in rows:
        lines.append(f"| {label} | {value} |")
    return "\n".join(lines)

def update_readme(stats_table):
    if not README_PATH.exists():
        print("⚠️ README.md not found")
        return False
    content = README_PATH.read_text(encoding="utf-8")
    pattern = re.compile(
        r"(<!-- THM_STATS_START -->)(.*?)(<!-- THM_STATS_END -->)",
        re.DOTALL,
    )
    replacement = (
        "<!-- THM_STATS_START -->\n"
        f"{stats_table}\n"
        "<!-- THM_STATS_END -->"
    )
    if not pattern.search(content):
        print("⚠️ THM_STATS markers not found in README.md")
        return False
    new_content = pattern.sub(replacement, content)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    new_content = re.sub(
        r"<!-- LAST_UPDATED: .* -->",
        f"<!-- LAST_UPDATED: {timestamp} -->",
        new_content,
    )
    README_PATH.write_text(new_content, encoding="utf-8")
    print("✅ README.md updated successfully")
    return True

def main():
    print(f"🔍 Fetching stats for THM user ID: {THM_USER_PUBLIC_ID}")
    stats = get_profile_stats()
    if not stats:
        print("❌ Could not fetch profile stats")
        sys.exit(1)
    print(f"📊 Stats: {stats}")
    table = format_stats_table(stats)
    if not update_readme(table):
        sys.exit(1)
    print("🎉 Done!")

if __name__ == "__main__":
    main()
