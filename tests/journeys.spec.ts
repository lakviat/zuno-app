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
  await page.mouse.move(gripBox.x + 20, gripBox.y + 45);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 20, gripBox.y - 15, { steps: 12 });
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

test('creates a public meetup, joins as a non-friend, persists, edits and cancels', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Meetups', exact: true }).click();
  await page.getByRole('button', { name: 'Sunset Harbour', exact: true }).click();
  await page.getByRole('button', { name: 'Create a meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Set meetup here', exact: true }).click();
  await page.getByRole('button', { name: 'Create meetup', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Add a title');
  await page
    .getByRole('textbox', { name: 'Meetup title', exact: true })
    .fill('A sunny afternoon walk');
  await page.getByRole('button', { name: 'Custom date/time', exact: true }).click();
  await page.getByLabel('Starts', { exact: true }).fill('2099-10-02T10:00');
  await page.getByLabel('Ends', { exact: true }).fill('2099-10-02T12:00');
  await page.getByRole('button', { name: 'Public nearby', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Capacity including you (optional)', exact: true })
    .fill('2');
  await page.getByRole('button', { name: 'Create meetup', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit meetup', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'Switch demo viewer' }).click();
  await page.getByRole('button', { name: 'View as Noah' }).click();
  await page.getByRole('button', { name: 'South Beach', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View A sunny afternoon walk' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sunset Harbour', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Coffee & a catch-up' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View A sunny afternoon walk' }).click();
  await page.getByRole('button', { name: 'Join meetup', exact: true }).click();
  await expect(page.getByText('2 going', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Meetups', exact: true }).click();
  await page.getByRole('button', { name: 'Switch demo viewer' }).click();
  await page.getByRole('button', { name: 'View as Noah' }).click();
  await page.getByRole('button', { name: 'View A sunny afternoon walk' }).click();
  await expect(page.getByRole('button', { name: 'Leave meetup', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave meetup', exact: true }).click();
  await expect(page.getByText('1 going', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'Switch demo viewer' }).click();
  await page.getByRole('button', { name: 'View as Maya' }).click();
  await page.getByRole('button', { name: 'View A sunny afternoon walk' }).click();
  await page.getByRole('button', { name: 'Edit meetup', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Capacity including you (optional)', exact: true })
    .fill('1');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least 2');
  await page
    .getByRole('textbox', { name: 'Capacity including you (optional)', exact: true })
    .fill('3');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Meetup cancelled', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View A sunny afternoon walk' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Joined', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View A sunny afternoon walk' })).toBeVisible();
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

test('meetup draft keeps its duration and requires an explicit discard', async ({ page }) => {
  await page.getByRole('button', { name: 'Meetups', exact: true }).click();
  await page.getByRole('button', { name: 'South Beach', exact: true }).click();
  await page.getByRole('button', { name: 'Create a meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Set meetup here', exact: true }).click();
  await page.getByRole('textbox', { name: 'Meetup title', exact: true }).fill('Draft to keep');
  await page.getByRole('button', { name: 'Custom date/time', exact: true }).click();
  await page.getByLabel('Starts', { exact: true }).fill('2099-10-02T23:30');
  await expect(page.getByLabel('Ends', { exact: true })).toHaveValue('2099-10-03T00:30');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Discard your unsaved changes?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('textbox', { name: 'Meetup title', exact: true })).toHaveValue(
    'Draft to keep',
  );
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('button', { name: 'View Draft to keep' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Set meetup here', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Meetup title', exact: true })).toBeEmpty();
  await page.getByRole('textbox', { name: 'Meetup title', exact: true }).fill('A park meetup');
  await page.getByRole('button', { name: 'Create meetup', exact: true }).click();
  await expect(
    page
      .getByText('Near Flamingo Park', { exact: true })
      .or(page.getByText('Pinned meeting spot', { exact: true })),
  ).toBeVisible();
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

for (const theme of ['Light', 'Dark'] as const) {
  test(`responsive map, selected friend and meetup details · ${theme}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Your profile', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    for (const viewport of [
      { width: 360, height: 740 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1440, height: 960 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      const alex = page.getByRole('button', { name: 'Find Alex Rivera', exact: true });
      await expect(alex).toBeVisible({ timeout: 25000 });
      await page.screenshot({
        path: `test-results/${theme.toLowerCase()}-${viewport.width}-map.png`,
      });
      await alex.click();
      await expect(page.getByRole('button', { name: 'Say hello', exact: true })).toBeVisible();
      if (viewport.width < 1000)
        await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0);
      await page.screenshot({
        path: `test-results/${theme.toLowerCase()}-${viewport.width}-friend.png`,
      });
      await page.getByRole('button', { name: 'Close friend card', exact: true }).click();
      await page.getByRole('button', { name: 'Meetups', exact: true }).click();
      await page.getByRole('button', { name: 'View Coffee & a catch-up', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Join meetup', exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/${theme.toLowerCase()}-${viewport.width}-meetup.png`,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
  });
}

test('drag reversal, stationary touch, release and repeated gestures retain map interactions', async ({
  page,
}) => {
  // Repeated pointer trajectories are paced by rendering. Software WebGL on CI
  // needs more wall time; preserve every gesture and coordinate assertion.
  if (process.env.CI) test.setTimeout(120000);
  const alex = page.getByRole('button', { name: 'Find Alex Rivera', exact: true });
  await expect(alex).toBeVisible({ timeout: 25000 });
  const grip = page.getByLabel('One-handed map zoom. Slide up to zoom in, down to zoom out.');
  const gripBox = (await grip.boundingBox())!;
  const x = gripBox.x + 22,
    y = gripBox.y + 32;
  const original = (await alex.boundingBox())!.x;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  expect((await alex.boundingBox())!.x).toBeCloseTo(original, 1);
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 80, { steps: 16 });
    await expect.poll(async () => (await alex.boundingBox())!.x).toBeLessThan(original);
    await page.mouse.move(x, y + 60, { steps: 24 });
    await expect.poll(async () => (await alex.boundingBox())!.x).toBeGreaterThan(original);
    await page.mouse.move(x, y, { steps: 12 });
    await expect
      .poll(async () => Math.abs((await alex.boundingBox())!.x - original))
      .toBeLessThan(1);
    await page.mouse.up();
  }
  // Pointer movement after release cannot keep moving the camera.
  await page.mouse.move(x, y - 200, { steps: 12 });
  expect((await alex.boundingBox())!.x).toBeCloseTo(original, 1);
  // Provider gestures outside the grip still work, then selection opens a usable card.
  const canvas = page.getByRole('region', { name: 'Map', exact: true });
  await canvas.dblclick({ position: { x: 800, y: 450 } });
  await page.mouse.move(500, 650);
  await page.mouse.down();
  await page.mouse.move(550, 680, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Recenter demo map' }).click();
  await alex.click();
  await expect(page.getByRole('button', { name: 'Say hello', exact: true })).toBeVisible();
});

test('map-native Now meetup, group chat, availability and public discovery controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Create meetup on map', exact: true }).click();
  await expect(page.getByText('Bring people here', { exact: true })).toBeVisible();
  await page.mouse.move(195, 350);
  await page.mouse.down();
  await page.mouse.move(200, 320, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Set meetup here', exact: true }).click();
  await page.getByRole('textbox', { name: 'Meetup title', exact: true }).fill('Coffee right now');
  await page.getByRole('button', { name: 'Now', exact: true }).click();
  await page.getByRole('button', { name: 'Public nearby', exact: true }).click();
  await page.getByRole('button', { name: '4 people', exact: true }).click();
  await page.getByRole('button', { name: 'Create meetup', exact: true }).click();
  await expect(page.getByText('Public nearby · Happening now', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Meetup message', exact: true })
    .fill('I am by the entrance.');
  await page.getByRole('button', { name: 'Send meetup message', exact: true }).click();
  await expect(page.getByText('I am by the entrance.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open meeting spot on map', exact: true }).click();
  await page.getByRole('button', { name: 'Set my availability', exact: true }).click();
  await page.getByRole('button', { name: 'Free now', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Your idea (optional)', exact: true }).fill('Coffee?');
  await page.getByRole('button', { name: 'Set availability', exact: true }).click();
  await page.getByRole('button', { name: 'Location privacy', exact: true }).click();
  await page.getByRole('button', { name: 'Public discovery', exact: true }).click();
  await expect(
    page.getByText(/Public discovery shows only an approximate neighborhood/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Messages', exact: true }).click();
  await page.getByRole('button', { name: 'Meetup chat Coffee right now', exact: true }).click();
  await expect(page.getByText('I am by the entrance.', { exact: true })).toBeVisible();
});

test('account entry explains sharing consent and configured sign-in availability', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Your profile', exact: true }).click();
  await page.getByRole('button', { name: 'Your Zuno account', exact: true }).click();
  await expect(
    page.getByText('Your location stays private until you explicitly enable sharing.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Open the iOS app to sign in|Online accounts are not enabled in this build/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Email me a sign-in link', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Your profile', exact: true })).toBeVisible();
});
