import { z } from "zod";

export const expenseCategories = {
  VENUE: "Venue", CATERING: "Catering", PHOTOGRAPHY: "Photography", VIDEOGRAPHY: "Videography",
  DECORATION: "Decoration", CLOTHING: "Clothing", JEWELLERY: "Jewellery", ENTERTAINMENT: "Entertainment",
  INVITATIONS: "Invitations", GIFTS: "Gifts", TRAVEL: "Travel", MAKEUP: "Makeup", OTHER: "Miscellaneous",
} as const;
export type ExpenseCategory = keyof typeof expenseCategories;
export const expenseTitleLimit = 120;
export const expenseNotesLimit = 500;
export const expenseMaxPaise = 9_999_999_999;

export const expenseIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid item.").toLowerCase();
const category = z.enum(Object.keys(expenseCategories) as ExpenseCategory[], { error: "Choose a category." });
const expenseDate = z.iso.date({ error: "Enter a valid date." });
const fields = z.strictObject({
  title: z.string().trim().min(1, "Enter an expense title.").max(expenseTitleLimit),
  amountPaise: z.number().int("Enter an amount with up to two decimal places.").min(1, "Enter an amount greater than zero.")
    .max(expenseMaxPaise, "Enter an amount up to ₹9,99,99,999.99."),
  currency: z.literal("INR"),
  expenseDate,
  category,
  eventId: expenseIdSchema.nullable().optional(),
  notes: z.string().trim().max(expenseNotesLimit).nullable().optional(),
});

export const createExpenseSchema = fields.extend({ currency: fields.shape.currency.default("INR") });
export const updateExpenseSchema = fields.partial().refine((input) => Object.keys(input).length > 0, "Provide an expense change.");
export const expenseListSchema = z.strictObject({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100_000)).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  category: category.optional(),
  eventId: z.union([expenseIdSchema, z.literal("none")]).optional(),
  from: expenseDate.optional(),
  to: expenseDate.optional(),
}).refine(({ from, to }) => !from || !to || from <= to, { path: ["to"], message: "End date must be on or after the start date." });

export type ExpenseValues = z.output<typeof createExpenseSchema>;
export type ExpenseChanges = z.output<typeof updateExpenseSchema>;
export type ExpenseFilters = z.output<typeof expenseListSchema>;
