import { Field } from '../../components/ui';
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <Field
      label={`${label} · YYYY-MM-DDTHH:mm`}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder="2026-10-01T17:30"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}
