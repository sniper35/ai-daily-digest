import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

const runnerSource = readFileSync(new URL('./run-digest-automation.ts', import.meta.url), 'utf8');

describe('digest automation runner', () => {
  test('runs the digest script as a child process', () => {
    expect(runnerSource).toContain("import { spawnSync } from 'node:child_process'");
    expect(runnerSource).toContain('spawnSync(process.execPath');
    expect(runnerSource).not.toContain('pathToFileURL');
  });

  test('verifies the timestamped digest exists before copying latest artifacts', () => {
    expect(runnerSource).toContain('if (!existsSync(outputPath))');
    expect(runnerSource).toContain('Digest completed without writing expected output');
    expect(runnerSource.indexOf('if (!existsSync(outputPath))')).toBeLessThan(runnerSource.indexOf('copyFileSync(outputPath, latestDigestPath)'));
  });
});
