import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The deployed build ships with no content: packs are generated from her
 * teachers' material, stay out of the repo, and arrive through the import
 * screen. This file covers that first-run state.
 *
 * It needs its own file because the mock below is module-wide. A dev machine
 * still has packs sitting in content/packs/ (gitignored, not deleted), so they
 * get bundled locally and the app under test would never be empty otherwise --
 * only a clean CI checkout reproduces it naturally.
 */
vi.mock('@/content/loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/content/loader')>()),
  loadBundledPacks: () => ({ packs: [], issues: [] }),
}));

const { App } = await import('@/App');

describe('the empty shell', () => {
  it('offers a way into the import screen when there is no content at all', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Inget material än')).toBeInTheDocument();

    // /import is not in the navigation, so this button is the only route to any
    // content on a device that has just loaded the app for the first time.
    await user.click(screen.getByRole('link', { name: 'Lägg till ett ämne' }));

    expect(await screen.findByText('Importera innehåll')).toBeInTheDocument();
    expect(screen.getByText('Välj fil…')).toBeInTheDocument();
  });
});
