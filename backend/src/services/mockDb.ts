// Mock Database for Testing (when Prisma is unavailable)
// This provides an in-memory store to test API endpoints

export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  birthDate: Date;
  lifeExpectancy: number;
  inboxEmail: string;
  enableRecommendations: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockContentByte {
  id: string;
  editionId: string;
  content: string;
  type: string;
  author: string | null;
  context: string | null;
  category: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  viewCount: number;
  saveCount: number;
  shareCount: number;
  engagementScore: number;
  trendingScore: number;
  qualityScore: number;
  isSponsored: boolean;
  sponsorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  sourceName?: string;
  sourceCategory?: string;
}

export interface MockUserEngagement {
  id: string;
  userId: string;
  byteId: string;
  vote: number;
  isSaved: boolean;
  isShared: boolean;
  viewCount: number;
  totalDwellTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockNewsletterSource {
  id: string;
  name: string;
  senderEmail: string;
  senderDomain: string;
  description: string | null;
  category: string;
  tags: string[];
  subscriberCount: number;
  totalEngagement: number;
  avgEngagementScore: number;
  isVerified: boolean;
  isSponsored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory data stores
const users: Map<string, MockUser> = new Map();
const contentBytes: Map<string, MockContentByte> = new Map();
const userEngagements: Map<string, MockUserEngagement> = new Map();
const newsletterSources: Map<string, MockNewsletterSource> = new Map();

// Seed with sample data
function seedData() {
  // Sample newsletter sources
  const sources: MockNewsletterSource[] = [
    {
      id: 'src-1',
      name: "Lenny's Newsletter",
      senderEmail: 'lenny@substack.com',
      senderDomain: 'substack.com',
      description: 'Product management insights',
      category: 'productivity',
      tags: ['product', 'management', 'startup'],
      subscriberCount: 1500,
      totalEngagement: 45000,
      avgEngagementScore: 0.85,
      isVerified: true,
      isSponsored: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'src-2',
      name: 'Brain Pickings',
      senderEmail: 'hello@brainpickings.org',
      senderDomain: 'brainpickings.org',
      description: 'Curated wisdom from literature and philosophy',
      category: 'wisdom',
      tags: ['philosophy', 'books', 'life'],
      subscriberCount: 2300,
      totalEngagement: 72000,
      avgEngagementScore: 0.92,
      isVerified: true,
      isSponsored: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'src-3',
      name: 'Stratechery',
      senderEmail: 'ben@stratechery.com',
      senderDomain: 'stratechery.com',
      description: 'Tech strategy and business analysis',
      category: 'tech',
      tags: ['tech', 'business', 'strategy'],
      subscriberCount: 890,
      totalEngagement: 28000,
      avgEngagementScore: 0.78,
      isVerified: true,
      isSponsored: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  sources.forEach(s => newsletterSources.set(s.id, s));

  // Sample content bytes
  const bytes: MockContentByte[] = [
    {
      id: 'byte-1',
      editionId: 'ed-1',
      content: 'The best time to plant a tree was 20 years ago. The second best time is now.',
      type: 'quote',
      author: 'Chinese Proverb',
      context: 'On taking action despite past regrets',
      category: 'wisdom',
      tags: ['action', 'time', 'growth'],
      upvotes: 234,
      downvotes: 12,
      viewCount: 5600,
      saveCount: 89,
      shareCount: 45,
      engagementScore: 0.89,
      trendingScore: 0.76,
      qualityScore: 0.92,
      isSponsored: false,
      sponsorId: null,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
      sourceName: 'Brain Pickings',
      sourceCategory: 'wisdom',
    },
    {
      id: 'byte-2',
      editionId: 'ed-2',
      content: 'Ship early and often. A product in users hands is worth a thousand in development.',
      type: 'insight',
      author: 'Lenny Rachitsky',
      context: 'Product development philosophy',
      category: 'productivity',
      tags: ['product', 'shipping', 'startup'],
      upvotes: 456,
      downvotes: 23,
      viewCount: 8900,
      saveCount: 167,
      shareCount: 78,
      engagementScore: 0.94,
      trendingScore: 0.88,
      qualityScore: 0.87,
      isSponsored: false,
      sponsorId: null,
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(),
      sourceName: "Lenny's Newsletter",
      sourceCategory: 'productivity',
    },
    {
      id: 'byte-3',
      editionId: 'ed-3',
      content: 'Aggregation theory: the internet enables new business models that aggregate demand.',
      type: 'insight',
      author: 'Ben Thompson',
      context: 'Understanding platform economics',
      category: 'tech',
      tags: ['platform', 'business', 'internet'],
      upvotes: 189,
      downvotes: 15,
      viewCount: 4200,
      saveCount: 56,
      shareCount: 34,
      engagementScore: 0.82,
      trendingScore: 0.65,
      qualityScore: 0.91,
      isSponsored: false,
      sponsorId: null,
      createdAt: new Date(Date.now() - 259200000),
      updatedAt: new Date(),
      sourceName: 'Stratechery',
      sourceCategory: 'tech',
    },
    {
      id: 'byte-4',
      editionId: 'ed-1',
      content: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
      type: 'quote',
      author: 'Aristotle',
      context: 'The foundation of personal growth',
      category: 'wisdom',
      tags: ['habits', 'excellence', 'philosophy'],
      upvotes: 567,
      downvotes: 8,
      viewCount: 12300,
      saveCount: 234,
      shareCount: 123,
      engagementScore: 0.97,
      trendingScore: 0.92,
      qualityScore: 0.95,
      isSponsored: false,
      sponsorId: null,
      createdAt: new Date(Date.now() - 345600000),
      updatedAt: new Date(),
      sourceName: 'Brain Pickings',
      sourceCategory: 'wisdom',
    },
    {
      id: 'byte-5',
      editionId: 'ed-2',
      content: 'The best product managers are customer-obsessed, not competitor-obsessed.',
      type: 'insight',
      author: 'Lenny Rachitsky',
      context: 'Focus on solving real problems',
      category: 'productivity',
      tags: ['product', 'customers', 'focus'],
      upvotes: 312,
      downvotes: 18,
      viewCount: 6700,
      saveCount: 98,
      shareCount: 56,
      engagementScore: 0.88,
      trendingScore: 0.79,
      qualityScore: 0.86,
      isSponsored: false,
      sponsorId: null,
      createdAt: new Date(Date.now() - 432000000),
      updatedAt: new Date(),
      sourceName: "Lenny's Newsletter",
      sourceCategory: 'productivity',
    },
  ];

  bytes.forEach(b => contentBytes.set(b.id, b));
}

// Initialize seed data
seedData();

// Mock Prisma-like API
export const mockDb = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string; inboxEmail?: string } }) => {
      if (where.id) return users.get(where.id) || null;
      if (where.email) {
        for (const user of users.values()) {
          if (user.email === where.email) return user;
        }
      }
      if (where.inboxEmail) {
        for (const user of users.values()) {
          if (user.inboxEmail === where.inboxEmail) return user;
        }
      }
      return null;
    },
    create: async ({ data }: { data: Partial<MockUser> }) => {
      const user: MockUser = {
        id: `user-${Date.now()}`,
        email: data.email!,
        passwordHash: data.passwordHash!,
        name: data.name!,
        birthDate: data.birthDate!,
        lifeExpectancy: data.lifeExpectancy || 80,
        inboxEmail: data.inboxEmail!,
        enableRecommendations: data.enableRecommendations ?? true,
        onboardingCompleted: data.onboardingCompleted ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.set(user.id, user);
      return user;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
      const user = users.get(where.id);
      if (!user) throw new Error('User not found');
      const updated = { ...user, ...data, updatedAt: new Date() };
      users.set(where.id, updated);
      return updated;
    },
  },

  contentByte: {
    findMany: async (options?: {
      where?: { category?: string; isSponsored?: boolean };
      orderBy?: { [key: string]: 'asc' | 'desc' }[];
      take?: number;
      skip?: number;
    }) => {
      let results = Array.from(contentBytes.values());

      if (options?.where?.category) {
        results = results.filter(b => b.category === options.where!.category);
      }
      if (options?.where?.isSponsored !== undefined) {
        results = results.filter(b => b.isSponsored === options.where!.isSponsored);
      }

      if (options?.orderBy) {
        for (const order of options.orderBy) {
          const [key, direction] = Object.entries(order)[0];
          results.sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[key];
            const bVal = (b as unknown as Record<string, unknown>)[key];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return 0;
          });
        }
      }

      if (options?.skip) {
        results = results.slice(options.skip);
      }
      if (options?.take) {
        results = results.slice(0, options.take);
      }

      return results;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return contentBytes.get(where.id) || null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<MockContentByte> }) => {
      const byte = contentBytes.get(where.id);
      if (!byte) throw new Error('ContentByte not found');
      const updated = { ...byte, ...data, updatedAt: new Date() };
      contentBytes.set(where.id, updated);
      return updated;
    },
  },

  userEngagement: {
    findUnique: async ({ where }: { where: { userId_byteId?: { userId: string; byteId: string } } }) => {
      if (where.userId_byteId) {
        const key = `${where.userId_byteId.userId}-${where.userId_byteId.byteId}`;
        return userEngagements.get(key) || null;
      }
      return null;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId_byteId: { userId: string; byteId: string } };
      create: Partial<MockUserEngagement>;
      update: Partial<MockUserEngagement>;
    }) => {
      const key = `${where.userId_byteId.userId}-${where.userId_byteId.byteId}`;
      const existing = userEngagements.get(key);

      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        userEngagements.set(key, updated);
        return updated;
      } else {
        const created: MockUserEngagement = {
          id: `eng-${Date.now()}`,
          userId: where.userId_byteId.userId,
          byteId: where.userId_byteId.byteId,
          vote: create.vote || 0,
          isSaved: create.isSaved || false,
          isShared: create.isShared || false,
          viewCount: create.viewCount || 0,
          totalDwellTimeMs: create.totalDwellTimeMs || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        userEngagements.set(key, created);
        return created;
      }
    },
  },

  newsletterSource: {
    findMany: async (options?: {
      where?: { category?: string; isVerified?: boolean };
      orderBy?: { [key: string]: 'asc' | 'desc' }[];
      take?: number;
    }) => {
      let results = Array.from(newsletterSources.values());

      if (options?.where?.category) {
        results = results.filter(s => s.category === options.where!.category);
      }
      if (options?.where?.isVerified !== undefined) {
        results = results.filter(s => s.isVerified === options.where!.isVerified);
      }

      if (options?.orderBy) {
        for (const order of options.orderBy) {
          const [key, direction] = Object.entries(order)[0];
          results.sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[key];
            const bVal = (b as unknown as Record<string, unknown>)[key];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return 0;
          });
        }
      }

      if (options?.take) {
        results = results.slice(0, options.take);
      }

      return results;
    },
  },

  // Stats
  getStats: () => ({
    users: users.size,
    contentBytes: contentBytes.size,
    engagements: userEngagements.size,
    sources: newsletterSources.size,
  }),
};

export default mockDb;
