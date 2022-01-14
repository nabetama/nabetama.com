---
title: Karabiner-Elementsで⌘英かなよりも快適に英数/かなを切り替えられるようになってた
description: >-
  その昔、SierraになってからというものUSキーボード民は試行錯誤して英数/かなの切り替えを行っていた。僕も例外に漏れず、⌘英かなやHammerSpoonを使ってはそのもっさりとした動作故、チャットで誤爆する事態が頻発していた。あまりにも情弱過ぎて知らなかったのだが、とうとうK…
date: '2017-07-13T16:51:09.172Z'
categories: []
keywords: []
slug: >-
  /@nabetama/karabiner-elements%E3%81%A7-%E8%8B%B1%E3%81%8B%E3%81%AA%E3%82%88%E3%82%8A%E5%9C%A7%E5%80%92%E7%9A%84%E3%81%AB%E5%BF%AB%E9%81%A9%E3%81%AB%E8%8B%B1%E6%95%B0-%E3%81%8B%E3%81%AA%E3%82%92%E5%88%87%E3%82%8A%E6%9B%BF%E3%81%88%E3%82%89%E3%82%8C%E3%82%8B-ec9643f955ec
---

その昔、SierraになってからというものUSキーボード民は試行錯誤して英数/かなの切り替えを行っていた。僕も例外に漏れず、⌘英かなやHammerSpoonを使ってはそのもっさりとした動作故、チャットで誤爆する事態が頻発していた。あまりにも情弱過ぎて知らなかったのだが、とうとうKarabiner-Elements with complex\_modifications によって全てが解決されたのである。

[**tekezo/Karabiner-Elements**  
_Karabiner-Elements - The next generation Karabiner for macOS Sierra_github.com](https://github.com/tekezo/Karabiner-Elements/tree/master/usage#how-to-use-complex-modifications "https://github.com/tekezo/Karabiner-Elements/tree/master/usage#how-to-use-complex-modifications")[](https://github.com/tekezo/Karabiner-Elements/tree/master/usage#how-to-use-complex-modifications)

Karabiner-ElementsはGUIでポチポチするだけでプラグイン的に設定をimportできます。そこになんと！

[**_Karabiner-Elements complex\_modifications rules_**  
Karabiner-Elements complex\_modifications rulespqrs.org](https://pqrs.org/osx/karabiner/complex_modifications/ "https://pqrs.org/osx/karabiner/complex_modifications/")[](https://pqrs.org/osx/karabiner/complex_modifications/)

![img.png](img.png)

わー！わー！

この設定をポチッとimportし、Enableにすれば完了です。即使えるようになるのも良い。これでkarabiner.jsonを書かなくてもいいし、hammmerspoonのためにluaを書く必要もなくなったので、誤爆も減ると思います。本当に快適になった。