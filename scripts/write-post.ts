const { writeFileSync } = require('fs')
const { format } = require('date-fns')

console.log('Creating a new post...')
const date = format(new Date(), 'yyyy-MM-dd')

const frontmatter = `---
title: ""
date: "${date}"
description: ""
lastModDate:
tags: []
---

`

const fileName = `${date}.mdx`
const filePath = `./content/posts/${fileName}`
writeFileSync(filePath, frontmatter)
console.log(`Created a new post: ${filePath}`)
