---
title: 日記
date: '2022-01-17T23:09:14.128Z'
---

## blog デザインを少し変更した

blogヘッダーの主張が激しかったので layout.js を少し変更した。

```js
// src/components/layout.js
const header = (
    <h1 className="main-heading">
        <Link to="/">{title}</Link>
    </h1>
```

```css
/* src/style.css */
font-size: var(--fontSize-4);
```

業務でほぼ react を書かなくなってしまったので、このblogを運用することで多少なりとも書いておきたい。

### css

いまのところデフォルトのcssを修正してそのまま使っているが特に不便はなく事足りている。
ただ最近は [tailwindcss](https://tailwindcss.com/)なるものが流行っていると聞いたので、近いうちに挑戦しておきたい。
