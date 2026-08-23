export function getCsrfToken(): string {
  const input = document.querySelector('input[name="csrf_token"]') as HTMLInputElement;
  return input ? input.value : '';
}
