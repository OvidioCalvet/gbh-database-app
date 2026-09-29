export type StoryAccent = 'orange' | 'blue' | 'gold' | 'coral' | 'navy'

export interface FeaturedStory {
  id: string
  title: string
  category: string
  accent: StoryAccent
}

export const featuredStories: FeaturedStory[] = [
  { id: '16th-avenue-diner', title: '16th Avenue Diner', category: 'Food & Drink', accent: 'orange' },
  { id: 'book-gallery-west', title: 'Book Gallery West', category: 'Retail', accent: 'blue' },
  { id: 'strega-nonnas-oven', title: 'Strega Nonna’s Oven', category: 'Food & Drink', accent: 'gold' },
  { id: 'sunshine-records', title: 'Sunshine Records', category: 'Arts & Culture', accent: 'coral' },
  { id: 'squarehouse-pizza', title: 'Squarehouse Pizza', category: 'Food & Drink', accent: 'navy' },
]
