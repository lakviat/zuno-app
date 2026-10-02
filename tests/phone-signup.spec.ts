import { expect, test } from '@playwright/test';

test('phone preview validates codes, restores only the local session, and signs out', async ({
  page,
}) => {
  const hostedRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('.supabase.co')) hostedRequests.push(request.url());
  });
  await page.goto('/');
  for (const provider of ['Apple', 'Google', 'Email', 'Phone'])
    await expect(
      page.getByRole('button', { name: `Continue with ${provider}`, exact: true }),
    ).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Phone', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('2025550123');
  await expect(page.getByRole('button', { name: 'Send code', exact: true })).toBeDisabled();
  await page.getByLabel('Phone number', { exact: true }).fill('+1 202 555 0123');
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.getByLabel('Verification code', { exact: true }).fill('0000');
  await expect(page.getByRole('button', { name: 'Verify & continue', exact: true })).toBeDisabled();
  await page.getByLabel('Verification code', { exact: true }).fill('111111');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('six-zero test code');
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(page.getByText('Local phone preview · sample data', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Sign out of local preview', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out of local preview', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Continue with Phone', exact: true }),
  ).toBeVisible();
  expect(hostedRequests).toEqual([]);
});

test('accepts another country, allows number correction and enforces resend cooldown', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Phone', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('+44 7700 900123');
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByRole('button', { name: 'Change phone number', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('+996 555 123456');
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await expect(page.getByText(/Continue with this test number: \+996555123456/)).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign out of local preview', exact: true }),
  ).toBeVisible();
});
