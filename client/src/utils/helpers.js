export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};

export const cn = (...classes) => classes.filter(Boolean).join(' ');

