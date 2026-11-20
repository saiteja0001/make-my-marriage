// Display-only examples until a source for public metrics is approved.
export const sampleMetrics = [
  { label: "Couples", value: "4,000+" },
  { label: "Average rating", value: "4.9/5" },
  { label: "Uptime", value: "99.9%" },
];

export const sampleGuestResponses = [
  { group: "Sharma family", guests: 4, status: "Attending" },
  { group: "Mehta family", guests: 2, status: "Awaiting reply" },
  { group: "Rao family", guests: 3, status: "Attending" },
];

export const sampleExpenses = [
  { label: "Venue and catering", amount: "₹1,85,000" },
  { label: "Photography", amount: "₹48,000" },
  { label: "Flowers and décor", amount: "₹32,500" },
];

export const eventPhotos: Record<string, { src: string; alt: string }> = {
  mehendi: {
    src: "/homepage/mehendi.webp",
    alt: "A henna artist applying bridal mehendi",
  },
  haldi: {
    src: "/homepage/haldi.webp",
    alt: "Marigolds and turmeric bowls set out for a Haldi ceremony",
  },
  sangeet: {
    src: "/homepage/sangeet.webp",
    alt: "A Sangeet stage lit with amber lights",
  },
  wedding: {
    src: "/homepage/ceremony.webp",
    alt: "A wedding mandap draped in flowers",
  },
};
