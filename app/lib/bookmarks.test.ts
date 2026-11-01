import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBookmarkTree } from "./bookmarks.ts";

const n = (slug: string, bookmark: boolean, bookmarkFolder: string | null) => ({ slug: [slug], title: slug, bookmark, bookmarkFolder });

test("only bookmarked notes appear; folder ignored without bookmark", () => {
  const tree = buildBookmarkTree([n("a", true, null), n("b", false, "X")], "lex");
  assert.deepEqual(tree.map((i) => i.label), ["a"]);
});

test("nested folders from slash path, folders first", () => {
  const tree = buildBookmarkTree([n("z", true, null), n("c1", true, "Dinner/Chicken"), n("c2", true, "Dinner/Chicken"), n("p", true, "Dinner")], "lex");
  assert.equal(tree[0].label, "Dinner");
  assert.deepEqual(tree[0].children!.map((i) => i.label), ["Chicken", "p"]);
  assert.deepEqual(tree[0].children![0].children!.map((i) => i.label), ["c1", "c2"]);
  assert.equal(tree[1].label, "z");
  assert.equal(tree[1].href, "/lex/z");
});
