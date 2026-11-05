/** Value of the input, select or textarea that fired a DOM event. */
export const eventValue = (event: Event): string =>
  (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
