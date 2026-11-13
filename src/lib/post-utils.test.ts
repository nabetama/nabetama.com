import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adjacentPosts,
  groupByTag,
  groupByYear,
  relatedPosts,
} from "./post-utils.ts";
import type { Post } from "./posts.ts";

const post = (id: string, date: string, tags: string[] = []): Post =>
  ({ id, date: new Date(date), tags }) as Post;

// 新しい順
const posts = [
  post("d", "2026-03-01", ["日記", "釣り"]),
  post("c", "2026-01-01", ["日記"]),
  post("b", "2025-06-01", ["Rust"]),
  post("a", "2025-01-01", ["日記", "釣り"]),
];

describe("groupByTag", () => {
  it("記事数の多い順、同数ならタグ名順に並べ、タグページの URL を付ける", () => {
    const tags = groupByTag(posts);
    assert.deepEqual(
      tags.map((t) => [t.name, t.posts.map((p) => p.id)]),
      [
        ["日記", ["d", "c", "a"]],
        ["釣り", ["d", "a"]],
        ["Rust", ["b"]],
      ],
    );
    assert.equal(tags[0].href, "/tags/日記/");
  });
});

describe("groupByYear", () => {
  it("新しい順の記事を年ごとにまとめる", () => {
    const years = groupByYear(posts, (d) => String(d.getUTCFullYear()));
    assert.deepEqual(
      years.map((y) => [y.year, y.posts.map((p) => p.id)]),
      [
        ["2026", ["d", "c"]],
        ["2025", ["b", "a"]],
      ],
    );
  });
});

describe("relatedPosts", () => {
  it("共通タグの多い記事を優先し、同数なら日付が近い記事を選ぶ。自分と共通タグなしは除く", () => {
    const related = relatedPosts(posts[0], posts);
    assert.deepEqual(
      related.map((p) => p.id),
      ["a", "c"],
    );
  });

  it("件数の上限を守る", () => {
    assert.equal(relatedPosts(posts[0], posts, 1).length, 1);
  });
});

describe("adjacentPosts", () => {
  it("1 つ新しい記事を newer、1 つ古い記事を older にする。端では片方がない", () => {
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(adjacentPosts(posts[1], posts)).map(([k, v]) => [
          k,
          v?.id,
        ]),
      ),
      { newer: "d", older: "b" },
    );
    assert.equal(adjacentPosts(posts[0], posts).newer, undefined);
    assert.equal(adjacentPosts(posts[3], posts).older, undefined);
  });
});
