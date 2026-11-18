export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
