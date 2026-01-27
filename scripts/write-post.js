import { writeFileSync } from 'fs';
import { format } from 'date-fns';

console.log('Creating a new post...');
const date = format(new Date(), 'yyyy-MM-dd');

const frontmatter = `---
title: ""
date: "${date}"
description: ""
lastModDate:
tags: []
---

`;

const fileName = `${date}.mdx`;
const filePath = `./src/content/posts/${fileName}`;
writeFileSync(filePath, frontmatter);
console.log(`Created a new post: ${filePath}`);
