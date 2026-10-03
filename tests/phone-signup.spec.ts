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
  await page.getByLabel('Phone number', { exact: true }).fill('202555012');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await page.getByLabel('Phone number', { exact: true }).fill('202-555-0123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resend code', exact: true })).toBeEnabled();
  await page.getByLabel('Verification code', { exact: true }).fill('0000');
  await expect(page.getByRole('button', { name: 'Verify & continue', exact: true })).toBeDisabled();
  await page.getByLabel('Verification code', { exact: true }).fill('111111');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('six-zero test code');
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(page.getByText('Phone test mode · sample data', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Sign out of phone test', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out of phone test', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Continue with Phone', exact: true }),
  ).toBeVisible();
  expect(hostedRequests).toEqual([]);
});

test('allows immediate resend and number correction in phone test mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Phone', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('+44 7700 900123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Change phone number', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('+996 555 123456');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/Continue with this test number: \+996555123456/)).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign out of phone test', exact: true }),
  ).toBeVisible();
});

test('unavailable providers are explained and do not launch external auth in test mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  for (const provider of ['Apple', 'Google', 'Email'])
    await expect(
      page.getByRole('button', { name: `Continue with ${provider}`, exact: true }),
    ).toBeDisabled();
  await expect(page.getByText(/Use Phone to test here/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Phone', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('2025550123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with Phone', exact: true }).click();
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue('');
  expect(errors.filter((value) => value.includes('Unexpected text node'))).toEqual([]);
});
