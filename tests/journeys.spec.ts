import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Your profile', exact: true })).toBeVisible();
});

test('map selection, zoom, local messaging and persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const alex = page.getByRole('button', { name: 'Find Alex Rivera', exact: true });
  await expect(alex).toBeVisible({ timeout: 25000 });
  await page.screenshot({ path: 'test-results/world-desktop.png' });
  const before = await alex.boundingBox();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(async () => (await alex.boundingBox())?.x).not.toBe(before?.x);
  await page.getByRole('button', { name: 'Recenter demo map' }).click();
  const grip = page.getByLabel('One-handed map zoom. Slide up to zoom in, down to zoom out.');
  const gripBox = (await grip.boundingBox())!;
  const gripBefore = await alex.boundingBox();
  await page.mouse.move(gripBox.x + 20, gripBox.y + 85);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 20, gripBox.y + 25, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await alex.boundingBox())?.x).not.toBe(gripBefore?.x);
  await page.getByRole('button', { name: 'Recenter demo map' }).click();
  await alex.click();
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Meet you in ten minutes!');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Meet you in ten minutes!', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Messages', exact: true }).click();
  await page.getByRole('button', { name: 'Chat with Alex Rivera' }).click();
  await expect(page.getByText('Meet you in ten minutes!', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('incoming and outgoing requests, then blocking a friend', async ({ page }) => {
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Requests (1)' }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Requests (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Your friends', exact: true }).click();
  await page.getByRole('button', { name: 'View Alex Rivera', exact: true }).click();
  await page.getByRole('button', { name: 'Block person' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Alex Rivera', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Find Alex Rivera', exact: true })).toHaveCount(0);
});

test('creates a plan, joins and leaves another plan', async ({ page }) => {
  await page.getByRole('button', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Make a plan', exact: true }).click();
  await page.getByRole('textbox', { name: 'What’s the plan?' }).fill('A sunny afternoon walk');
  await page
    .getByRole('textbox', { name: 'A little more (optional)' })
    .fill('Meet by the park entrance.');
  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s make it happen' }).click();
  await expect(page.getByText('A sunny afternoon walk', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'You’re in · tap to leave' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'View Coffee & a catch-up' }).click();
  await page.getByRole('button', { name: 'Count me in' }).click();
  await page.getByRole('button', { name: 'You’re in · tap to leave' }).click();
  await expect(page.getByRole('button', { name: 'Count me in' })).toBeVisible();
});

test('profile edits, dark mode, privacy and ghost mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Your profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile & status' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Maya Sunshine');
  await page.getByRole('button', { name: 'Save your changes' }).click();
  await expect(page.getByText('Maya Sunshine', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Location & privacy' }).click();
  await page.getByRole('radio', { name: /Right here/ }).click();
  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  await page.getByRole('button', { name: 'Share for one hour' }).click();
  await expect(page.getByRole('button', { name: 'Stop temporary sharing' })).toBeVisible();
  await page.getByRole('switch', { name: 'Ghost mode' }).click();
  await expect(page.getByRole('button', { name: 'Stop temporary sharing' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share for one hour' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ path: 'test-results/world-dark.png' });
  await page.reload();
  await page.getByRole('button', { name: 'Location privacy' }).click();
  await expect(page.getByRole('radio', { name: /Just for you/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('phone and tablet layouts keep navigation and sheets usable', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Everyone', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find Alex Rivera', exact: true })).toBeVisible({
      timeout: 25000,
    });
    await page.screenshot({ path: `test-results/world-${viewport.width}.png` });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'People', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Search friends' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
});
