const SEED_TIMESTAMP = Date.UTC(2026, 0, 1);

export type SeedUser = {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  image: string | null;
  role: "PARENT" | "TEACHER" | "DIRECTOR";
  createdAt: number;
  updatedAt: number;
};

type ExistingSeedUser = Pick<SeedUser, "clerkId" | "createdAt"> &
  Partial<Pick<SeedUser, "image">>;

export const developmentSeed = {
  users: [
    {
      id: "seed-user-parent-roza",
      clerkId: "seed:parent-roza",
      name: "Róza Rohlíková",
      email: "krizmate+rodic-roza-rohlikova@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-parent-bedrich",
      clerkId: "seed:parent-bedrich",
      name: "Bedřich Bábovka",
      email: "krizmate+rodic-bedrich-babovka@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-parent-vera",
      clerkId: "seed:parent-vera",
      name: "Věra Vrtulová",
      email: "krizmate+rodic-vera-vrtulova@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-teacher-kveta",
      clerkId: "seed:teacher-kveta",
      name: "Květa Křída",
      email: "krizmate+ucitel-kveta-krida@gmail.com",
      image: null,
      role: "TEACHER",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-teacher-hugo",
      clerkId: "seed:teacher-hugo",
      name: "Hugo Hvízd",
      email: "krizmate+ucitel-hugo-hvizd@gmail.com",
      image: null,
      role: "TEACHER",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-director-bohumil",
      clerkId: "seed:director-bohumil",
      name: "Bohumil Boss",
      email: "krizmate+reditel-bohumil-boss@gmail.com",
      image: null,
      role: "DIRECTOR",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
  ],
  children: [
    {
      id: "seed-child-zofie",
      firstName: "Žofie",
      lastName: "Žížalka",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-oskar",
      firstName: "Oskar",
      lastName: "Okurka",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-bozena",
      firstName: "Božena",
      lastName: "Bublina",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-max",
      firstName: "Max",
      lastName: "Mlsoun",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-tobias",
      firstName: "Tobiáš",
      lastName: "Tornádo",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
  ],
  parentChildren: [
    {
      id: "seed-relation-roza-zofie",
      parentId: "seed-user-parent-roza",
      childId: "seed-child-zofie",
      createdAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-relation-roza-oskar",
      parentId: "seed-user-parent-roza",
      childId: "seed-child-oskar",
      createdAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-relation-bedrich-bozena",
      parentId: "seed-user-parent-bedrich",
      childId: "seed-child-bozena",
      createdAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-relation-bedrich-max",
      parentId: "seed-user-parent-bedrich",
      childId: "seed-child-max",
      createdAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-relation-vera-tobias",
      parentId: "seed-user-parent-vera",
      childId: "seed-child-tobias",
      createdAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-relation-vera-max",
      parentId: "seed-user-parent-vera",
      childId: "seed-child-max",
      createdAt: SEED_TIMESTAMP,
    },
  ],
} as const satisfies {
  users: readonly SeedUser[];
  children: readonly {
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
    createdAt: number;
    updatedAt: number;
  }[];
  parentChildren: readonly {
    id: string;
    parentId: string;
    childId: string;
    createdAt: number;
  }[];
};

export function mergeSeedUser(
  seed: SeedUser,
  existing?: ExistingSeedUser,
): SeedUser {
  if (!existing) {
    return seed;
  }

  return {
    ...seed,
    clerkId: existing.clerkId,
    image: existing.image ?? seed.image,
    createdAt: existing.createdAt,
  };
}
