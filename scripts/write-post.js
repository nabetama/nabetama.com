import { existsSync, writeFileSync } from "node:fs";

// 記事のファイル名と date はサイトのタイムゾーン (Asia/Tokyo) の日付にする
const date = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
}).format(new Date());

const frontmatter = `---
title: ""
date: "${date}"
description: ""
lastModDate:
tags: []
---

`;

const filePath = `./src/content/posts/${date}.mdx`;
if (existsSync(filePath)) {
  console.error(`Already exists: ${filePath}`);
  process.exit(1);
}
writeFileSync(filePath, frontmatter);
console.log(`Created a new post: ${filePath}`);
