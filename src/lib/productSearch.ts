import type { Product } from "../types/store";
import { cleanSearchTerm } from "../data/publicApi";

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length > right.length) i++;
    else if (right.length > left.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function wordMatch(queryWord: string, productWord: string): number {
  if (queryWord === productWord) return 100;
  if (queryWord.length >= 3 && productWord.startsWith(queryWord)) return 76;
  if (productWord.length >= 4 && queryWord.startsWith(productWord)) return 58;
  if (queryWord.length >= 4 && productWord.includes(queryWord)) return 48;
  if (queryWord.length >= 4 && productWord.length >= 4 && editDistanceAtMostOne(queryWord, productWord)) return 34;
  return 0;
}

function words(value: string): string[] {
  return cleanSearchTerm(value).split(" ").filter(Boolean);
}

function score(product: Product, query: string): number {
  const title = cleanSearchTerm(product.name);
  const phrase = cleanSearchTerm(query);
  const queryWords = words(query);
  const titleWords = words(product.name);
  const otherWords = words(`${product.category ?? ""} ${product.description}`);
  if (!queryWords.length) return 0;

  let result = title === phrase ? 10_000 : title.startsWith(phrase) ? 5_000 : title.includes(phrase) ? 3_200 : 0;
  const titleMatches = queryWords.map((word) => Math.max(0, ...titleWords.map((candidate) => wordMatch(word, candidate))));
  const otherMatches = queryWords.map((word) => Math.max(0, ...otherWords.map((candidate) => wordMatch(word, candidate))));
  const titleCovered = titleMatches.filter(Boolean).length;
  const otherCovered = otherMatches.filter(Boolean).length;

  result += titleMatches.reduce((sum, match) => sum + match, 0) * 10;
  result += otherMatches.reduce((sum, match, index) => sum + (titleMatches[index] ? 0 : match), 0) * 1.4;
  result += titleCovered === queryWords.length ? 900 : titleCovered * 100;
  if (otherCovered === queryWords.length && titleCovered < queryWords.length) result += 60;

  // Reward title words appearing in the same order as the query, and more strongly when they are adjacent.
  let nextTitleWord = 0;
  let ordered = 0;
  let adjacent = 0;
  for (const queryWord of queryWords) {
    const foundAt = titleWords.findIndex((candidate, index) => index >= nextTitleWord && wordMatch(queryWord, candidate) > 0);
    if (foundAt >= 0) {
      ordered++;
      if (foundAt === nextTitleWord) adjacent++;
      nextTitleWord = foundAt + 1;
    }
  }
  result += ordered * 28 + adjacent * 42;
  return result;
}

/** Rank exact phrases and close product-name matches ahead of broader keyword matches. */
export function rankProductResults(products: Product[], query: string): Product[] {
  const normalized = cleanSearchTerm(query);
  if (!normalized) return products;
  return products
    .map((product, index) => ({ product, index, score: score(product, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.product.createdAt.localeCompare(a.product.createdAt) || a.index - b.index)
    .map((item) => item.product);
}
