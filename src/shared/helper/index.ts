export function random<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export const formatVND = (amount?: number | null) => {
  if (!amount) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};
