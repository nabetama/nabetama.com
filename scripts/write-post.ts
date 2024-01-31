const { writeFileSync } = require('fs')
const { format } = require('date-fns')

console.log('Creating a new post...')
// ./content/popsts の中に YYYY-MM-dd.mdx というファイル名でファイルを作成する
const date = format(new Date(), 'yyyy-MM-dd')
const content = `---
title: ""
date: "${date}"
description: ""
lastModDate:
tags: []
---

`

const fileName = `${date}.mdx`
const filePath = `./content/posts/${fileName}`
writeFileSync(filePath, content)
console.log(`Created a new post: ${filePath}`)
