// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const siteDir = __dirname;
const eslint = new ESLint({ cwd: siteDir });

async function messages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(siteDir, filePath) });
  return result.messages.map((message) => message.message);
}

const hasBoundaryRules = readFileSync(path.join(siteDir, 'eslint.config.mjs'), 'utf8').includes('RAW_CT_FETCH');

describe('design lint', () => {
  it('Raw value in a component: hex, px and a foreign font family are reported; the Broadband Facts label is exempt', async () => {
    const hex = 'export const a = <p className="bg-[#fff]">x</p>;\n';
    const px = 'export const a = <p className="p-[16px]">x</p>;\n';
    const font = "export const a = 'font-family: Lato';\n";
    const template = 'export const a = (id: string) => `p-[16px] ${id}`;\n';

    expect(await messages('components/ui/x.tsx', hex)).toContain('Raw hex color — use a design-system color token via var().');
    expect(await messages('components/ui/x.tsx', px)).toContain('Raw px value — use a design-system spacing token via var().');
    expect(await messages('components/ui/x.tsx', font)).toContain('Font not provided by the design system. Available: Exo, Inter, Roboto.');
    expect(await messages('components/ui/x.tsx', template)).toContain('Raw px value — use a design-system spacing token via var().');

    expect(await messages('components/label/BroadbandLabel.tsx', hex)).toEqual([]);
    expect(await messages('components/ui/x.test.tsx', hex)).toEqual([]);
    expect(await messages('app/dev/tokens/page.dev.tsx', hex)).toEqual([]);
  });

  it('accepts design-font family declarations and token classes', async () => {
    expect(await messages('components/ui/x.tsx', "export const a = 'font-family: Exo, sans-serif';\n")).toEqual([]);
    expect(await messages('components/ui/x.tsx', 'export const a = <p className="bg-brand-500 text-text-on-brand">x</p>;\n')).toEqual([]);
  });

  it.skipIf(!hasBoundaryRules)("keeps workstream B's raw fetch rule in components", async () => {
    const found = await messages('components/ui/x.tsx', "export async function load() { return fetch('/api/x'); }\n");
    expect(found.length).toBeGreaterThan(0);
  });
});
