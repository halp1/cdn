interface StoredObj {
  key: string;
  isFolder: boolean;
  lower: string;
}

let objects: StoredObj[] = [];

const fuzzyScore = (lower: string, q: string): number | null => {
  let qi = 0;
  let lastMatchIdx = -1;
  let totalGap = 0;
  let consecutiveBonus = 0;
  let prevMatched = false;

  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      if (lastMatchIdx !== -1) totalGap += i - lastMatchIdx - 1;
      if (prevMatched) consecutiveBonus += 10;
      lastMatchIdx = i;
      prevMatched = true;
      qi++;
    } else {
      prevMatched = false;
    }
  }

  if (qi < q.length) return null;

  const filenameStart = Math.max(lower.lastIndexOf("/") + 1, 0);
  const filenameBonus = lower.slice(filenameStart).includes(q) ? 20 : 0;

  return -totalGap + consecutiveBonus + filenameBonus;
};

type InMessage =
  | { type: "init"; payload: { key: string; isFolder: boolean }[] }
  | { type: "search"; payload: string };

self.onmessage = ({ data }: MessageEvent<InMessage>) => {
  if (data.type === "init") {
    objects = data.payload.map((obj) => ({ ...obj, lower: obj.key.toLowerCase() }));
  } else if (data.type === "search") {
    const q = data.payload.toLowerCase();
    const scored: { key: string; isFolder: boolean; score: number }[] = [];
    for (const { key, isFolder, lower } of objects) {
      const score = fuzzyScore(lower, q);
      if (score !== null) scored.push({ key, isFolder, score });
    }
    scored.sort((a, b) => b.score - a.score);
    self.postMessage({
      query: data.payload,
      results: scored.slice(0, 100).map(({ key, isFolder }) => ({ key, isFolder }))
    });
  }
};
