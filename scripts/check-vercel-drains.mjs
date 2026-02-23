import fs from "fs";

const authPath = `${process.env.HOME}/Library/Application Support/com.vercel.cli/auth.json`;
const { token } = JSON.parse(fs.readFileSync(authPath, "utf8"));

const projectId = "prj_q8Bf16wXNezxuKAehdIsVZBw2BFk";
const teamId = "team_d8TD8al7Effx9Oumnn3xomTj";

const res = await fetch(
  `https://api.vercel.com/v1/projects/${projectId}/drains?teamId=${teamId}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);

const text = await res.text();
console.log(`status=${res.status}`);
console.log(text);
