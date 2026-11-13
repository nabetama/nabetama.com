import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, isoDate, yearOf } from "./date.ts";

describe("date", () => {
  it("Asia/Tokyo の日付で表示する (UTC では前日の時刻でも日本の日付になる)", () => {
    const d = new Date("2025-12-31T16:00:00Z"); // JST 2026-01-01 01:00
    assert.equal(formatDate(d), "2026年01月01日");
    assert.equal(isoDate(d), "2026-01-01");
    assert.equal(yearOf(d), "2026");
  });
});
