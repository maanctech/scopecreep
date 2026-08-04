export function displayDate(value: string | Date | null) {
  return value ? new Date(value).toLocaleString() : "Date not provided";
}
