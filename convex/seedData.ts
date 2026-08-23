const SEED_TIMESTAMP = Date.UTC(2026, 0, 1);

export type SeedUser = {
  id: string;
  workosId: string;
  name: string;
  email: string;
  image: string | null;
  role: "PARENT" | "TEACHER" | "DIRECTOR";
  createdAt: number;
  updatedAt: number;
};

type ExistingSeedUser = Pick<SeedUser, "createdAt"> &
  Partial<Pick<SeedUser, "workosId">>;

export const developmentSeed = {
  users: [
    {
      id: "seed-user-parent-roza",
      workosId: "seed:parent-roza",
      name: "Róza Rohlíková",
      email: "krizmate+rodic-roza-rohlikova@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-parent-bedrich",
      workosId: "seed:parent-bedrich",
      name: "Bedřich Bábovka",
      email: "krizmate+rodic-bedrich-babovka@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-parent-vera",
      workosId: "seed:parent-vera",
      name: "Věra Vrtulová",
      email: "krizmate+rodic-vera-vrtulova@gmail.com",
      image: null,
      role: "PARENT",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-teacher-kveta",
      workosId: "seed:teacher-kveta",
      name: "Květa Křída",
      email: "krizmate+ucitel-kveta-krida@gmail.com",
      image: null,
      role: "TEACHER",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-teacher-hugo",
      workosId: "seed:teacher-hugo",
      name: "Hugo Hvízd",
      email: "krizmate+ucitel-hugo-hvizd@gmail.com",
      image: null,
      role: "TEACHER",
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-user-director-bohumil",
      workosId: "seed:director-bohumil",
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
      gender: "FEMALE",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-oskar",
      firstName: "Oskar",
      lastName: "Okurka",
      gender: "MALE",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-bozena",
      firstName: "Božena",
      lastName: "Bublina",
      gender: "FEMALE",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-max",
      firstName: "Max",
      lastName: "Mlsoun",
      gender: "MALE",
      active: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: "seed-child-tobias",
      firstName: "Tobiáš",
      lastName: "Tornádo",
      gender: "MALE",
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
    gender: "MALE" | "FEMALE";
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
    workosId: existing.workosId ?? seed.workosId,
    createdAt: existing.createdAt,
  };
}
