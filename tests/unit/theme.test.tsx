// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
import { App } from '../../static/app/src/App';
const css = readFileSync('static/app/src/styles.css', 'utf8');
afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});
describe('simulated host token compatibility (jsdom; not installed Jira visual acceptance)', () => {
  it.each([
    ['light', '#172b4d', '#ffffff', '#f7f8f9', '#dcdfe4', '#44546f'],
    ['dark', '#b6c2cf', '#1d2125', '#22272b', '#38414a', '#9fadbc'],
  ])(
    'uses injected %s tokens across shell and action',
    (_, text, surface, raised, neutral, subtle) => {
      const style = document.createElement('style');
      style.textContent = `:root { --ds-text: ${text}; --ds-surface: ${surface}; --ds-surface-raised: ${raised}; --ds-background-neutral: ${neutral}; --ds-text-subtle: ${subtle}; --ds-text-disabled: ${subtle}; --ds-background-disabled: ${surface}; --ds-border: ${subtle}; --ds-border-focused: ${text}; }\n${css}`;
      document.head.append(style);
      render(<App />);
      const expected = (color: string) => {
        const element = document.createElement('span');
        element.style.color = color;
        document.body.append(element);
        const rgb = getComputedStyle(element).color;
        element.remove();
        return rgb;
      };
      expect(getComputedStyle(document.body).color).toBe(expected(text));
      expect(getComputedStyle(document.body).backgroundColor).toBe(
        expected(surface),
      );
      expect(
        getComputedStyle(
          screen.getByRole('region', { name: 'Engineering foundation' }),
        ).backgroundColor,
      ).toBe(expected(raised));
      expect(
        getComputedStyle(
          screen.getByRole('button', { name: 'Run health check' }),
        ).color,
      ).toBe(expected(text));
      expect(
        getComputedStyle(
          screen.getByRole('button', { name: 'Run health check' }),
        ).backgroundColor,
      ).toBe(expected(neutral));
      expect(getComputedStyle(document.querySelector('.eyebrow')!).color).toBe(
        expected(subtle),
      );
      expect(
        getComputedStyle(
          screen.getByRole('region', { name: 'Engineering foundation' }),
        ).borderTopColor,
      ).toBe(expected(subtle));
      (
        screen.getByRole('button', {
          name: 'Run health check',
        }) as HTMLButtonElement
      ).disabled = true;
      expect(
        getComputedStyle(
          screen.getByRole('button', { name: 'Run health check' }),
        ).color,
      ).toBe(expected(subtle));
      expect(
        getComputedStyle(
          screen.getByRole('button', { name: 'Run health check' }),
        ).backgroundColor,
      ).toBe(expected(surface));
    },
  );
  it('keeps every colour declaration token-based, including keyboard focus, and enables the host API', () => {
    const colours = [
      ...css.matchAll(/(?:color|background|border|outline):\s*([^;]+);/g),
    ];
    expect(colours.length).toBeGreaterThan(8);
    for (const [, value] of colours) expect(value).toContain('var(--ds-');
    expect(css).toContain('button:focus-visible');
    expect(readFileSync('static/app/src/main.tsx', 'utf8')).toContain(
      'view.theme.enable()',
    );
  });
});
