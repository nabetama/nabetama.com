---
title: Real World HTTP
date: '2022-04-08T18:03:00.127Z'
---

買ったことすら忘れてしまっていたが、PDF を溜め込んでるストレージを整理していたら発掘したので改めて読み始めた。

いま第3章を読んでいる。知ってる内容の方が多いが、忘れていたことや知らなかったこともあり読み応えがある。
加えて以前はたまに書いていた Go も、ここ数年全く書かなくなってしまったので、そのリハビリも兼ねることが出来そうだ。

3章ではHTTPクライアントを実装しながら、順を追ってHTTPの仕組みを学んでいく。

* 単純なGET
* クエリストリングありのGET
* POST
* ...

上記のように自分でクライアントとサーバーの両方を実装することで、より深い理解が出来るようになっている。
また、その過程で基礎的な Go らしい書き方や言語の設計思想・文化などもわかるようになっていて面白い。
例えば `io.Reader`, `io.Writer` がある（抽象化されている）ことがなぜ美味しいのか、みたいな話も、それなりの字数を割いて説明している。
Go を初めて学ぶ人にも是非お勧めしたい内容だ（Tour of Go は完了している前提にはなりそう）。

```go
ioutil.ReadAll(reader io.Reader) ([]byte error)
```

## まとめ

業務で扱うシーンが少ない技術領域かもしれないが、基礎的な知識を体系的に学べる書籍は稀なのでありがたく読み切ろうと思う。
本書が発売されたのは2017年のようだが、第2版の発売が予定されているのでどう変わったのも気になっている。

<iframe sandbox="allow-popups allow-scripts allow-modals allow-forms allow-same-origin" style="width:120px;height:240px;" marginwidth="0" marginheight="0" scrolling="no" frameborder="0" src="//rcm-fe.amazon-adsystem.com/e/cm?lt1=_blank&bc1=000000&IS2=1&bg1=FFFFFF&fc1=000000&lc1=0000FF&t=nabetama-22&language=ja_JP&o=9&p=8&l=as4&m=amazon&f=ifr&ref=as_ss_li_til&asins=4873119030&linkId=e927c8a8a356a20f366021da97e17ad1"></iframe>