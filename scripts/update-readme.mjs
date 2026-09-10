// scripts/update-readme.mjs
// Rewrites the block between <!--THM:START--> and <!--THM:END--> in
// README.md using data/thm-data.json + the badge screenshot.

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/thm-data.json', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');

const roomsList = data.completedRooms.length
  ? data.completedRooms.slice(0, 10).map(r => `- ${r}`).join('\n')
  : '_Room list unavailable this sync — screenshot badge still current._';

const block = `<!--THM:START-->
### 🏆 TryHackMe Progress

<p align="center">
  <img src="https://raw.githubusercontent.com/KyrilosKamal/KyrilosKamal/main/assets/thm_badge.png" alt="TryHackMe badge"/>
</p>

${data.rank ? `**Rank:** ${data.rank.trim()}  ` : ''}
${data.level ? `**Level:** ${data.level.trim()}  ` : ''}
${data.badgeCount ? `**Badges:** ${data.badgeCount}` : ''}

**Recently completed rooms:**
${roomsList}

<sub>Last synced: ${data.updatedAt}</sub>
<!--THM:END-->`;

const updated = readme.includes('<!--THM:START-->')
  ? readme.replace(/<!--THM:START-->[\s\S]*?<!--THM:END-->/, block)
  : readme + '\n\n' + block + '\n';

fs.writeFileSync('README.md', updated);
console.log('[update-readme] README.md updated.');
