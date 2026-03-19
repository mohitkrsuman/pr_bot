export function getValidDiffLines(patch: string): number[] {
  const validLines: number[] = [];
  let currentLine = 0;

  for (const line of patch.split("\n")) {
    // Parse the @@ header to get the starting line number
    // e.g. @@ -10,4 +12,8 @@ means new file starts at line 12
    const header = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      currentLine = parseInt(header[1], 10) - 1;
      continue;
    }

    if (line.startsWith("-")) {
      // Removed line — not in new file, skip
      continue;
    }

    currentLine++;

    if (line.startsWith("+")) {
      // This is an added line — valid for inline comments
      validLines.push(currentLine);
    }
  }

  return validLines;
}