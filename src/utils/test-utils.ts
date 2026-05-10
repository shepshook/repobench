import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

export function assertEquals(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Assertion Failed: ${message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`}`);
  }
}

export async function runTest(name: string, fn: () => Promise<void> | void) {
  console.log(`Running test: ${name}...`);
  try {
    await fn();
    console.log(`✅ ${name} passed`);
  } catch (e: any) {
    console.error(`❌ ${name} failed: ${e.message}`);
    process.exit(1);
  }
}
