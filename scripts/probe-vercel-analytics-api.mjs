import fs from "fs";

const token = JSON.parse(
  fs.readFileSync(
    `${process.env.HOME}/Library/Application Support/com.vercel.cli/auth.json`,
    "utf8",
  ),
).token;

const teamId = "team_d8TD8al7Effx9Oumnn3xomTj";
const projectId = "prj_q8Bf16wXNezxuKAehdIsVZBw2BFk";
const candidates = [
  `https://api.vercel.com/v1/analytics?projectId=${projectId}&teamId=${teamId}`,
  `https://api.vercel.com/v1/web-analytics?projectId=${projectId}&teamId=${teamId}`,
  `https://api.vercel.com/v2/analytics?projectId=${projectId}&teamId=${teamId}`,
  `https://api.vercel.com/v2/web-analytics?projectId=${projectId}&teamId=${teamId}`,
  `https://api.vercel.com/v1/projects/${projectId}/analytics?teamId=${teamId}`,
  `https://api.vercel.com/v1/projects/${projectId}/web-analytics?teamId=${teamId}`,
];

for (const url of candidates) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  console.log(`\n${url}`);
  console.log(`status=${res.status}`);
  console.log(text.slice(0, 300));
}
