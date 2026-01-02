import { defineCollection, z } from 'astro:content';

const mealsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.number(),
    name: z.string(),
    emoji: z.string(),
    time: z.number(),
    cost: z.enum(['$', '$$', '$$$']),
    cuisine: z.string(),
    tags: z.array(z.string()).default([]),
    allergens: z.array(z.enum(['dairy', 'gluten', 'nuts', 'shellfish', 'soy', 'eggs'])).default([]),
    dietScore: z.number().min(1).max(5),
  }),
});

const upgradesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    type: z.enum(['token-boost', 'reroll', 'cost-reduction', 'special']),
    effect: z.string(),
  }),
});

const narrativeCollection = defineCollection({
  type: 'content',
  schema: z.object({
    type: z.enum(['conflict', 'harmony', 'intro']),
    messages: z.array(z.string()),
  }),
});

export const collections = {
  'meals': mealsCollection,
  'upgrades': upgradesCollection,
  'narrative': narrativeCollection,
};
