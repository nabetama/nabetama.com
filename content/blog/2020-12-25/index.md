---
title: ムームードメインからRoute53へドメインを移管した
description: 長いこと、ムームードメインに置いてたドメインを Route53に移管した。
date: '2020-12-25T05:47:48.858Z'
categories: []
keywords: []
slug: >-
  /@nabetama/%E3%83%A0%E3%83%BC%E3%83%A0%E3%83%BC%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E3%81%8B%E3%82%89route53%E3%81%B8%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E3%82%92%E7%A7%BB%E7%AE%A1%E3%81%97%E3%81%9F-e3b7cf24d901
---

長いこと、ムームードメインに置いてたドメインを Route53に移管した。

特に難しいステップは無い。Route 53, ムームードメインにも丁寧なドキュメントが用意されているのでそれを沿って進めた。

*   [ドメインを他社へ移管したい。(『.jp』以外)](https://support.muumuu-domain.com/hc/ja/articles/360046369393-%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E3%82%92%E4%BB%96%E7%A4%BE%E3%81%B8%E7%A7%BB%E7%AE%A1%E3%81%97%E3%81%9F%E3%81%84-jp-%E4%BB%A5%E5%A4%96-)
*   [Route 53 を使用中のドメインの DNS サービスにする](https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/migrate-dns-domain-in-use.html#migrate-dns-get-zone-file)
*   [ドメイン登録の Amazon Route 53 への移管](https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/domain-transfer-to-route-53.html)

ムームードメインで困ってることは何もなかったが、プライベートで aws 触り始めたので、どうせならベンダーロックインされておこうというのが理由。