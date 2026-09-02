export const UserRole = {
  PARENT: "PARENT",
  TEACHER: "TEACHER",
  DIRECTOR: "DIRECTOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Presence = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
} as const;

export type Presence = (typeof Presence)[keyof typeof Presence];

export const ExcuseDayPart = {
  FULL_DAY: "FULL_DAY",
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
} as const;

export type ExcuseDayPart =
  (typeof ExcuseDayPart)[keyof typeof ExcuseDayPart];

export const ExcuseStatus = {
  NONE: "NONE",
  EXCUSED: "EXCUSED",
  UNEXCUSED: "UNEXCUSED",
} as const;

export type ExcuseStatus =
  (typeof ExcuseStatus)[keyof typeof ExcuseStatus];

export const ChildGender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
} as const;

export type ChildGender = (typeof ChildGender)[keyof typeof ChildGender];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export type User = {
  id: string;
  workosId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type Child = {
  id: string;
  firstName: string;
  lastName: string;
  gender: ChildGender | null;
  doesNotTakeLunch: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ParentChild = {
  id: string;
  parentId: string;
  childId: string;
  createdAt: Date;
};

export type Attendance = {
  id: string;
  childId: string;
  date: Date;
  presence: Presence;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Excuse = {
  id: string;
  childId: string;
  fromDate: Date;
  toDate: Date;
  reason: string | null;
  /** Which part of every covered school day the child will miss. */
  dayPart: ExcuseDayPart;
  /** Whether an excused absence should also cancel the child's lunch. */
  cancelLunch: boolean;
  submittedById: string;
  submittedAt: Date;
  /** Set when a late submission is approved or needs no review. */
  lateApprovedAt: Date | null;
  lateApprovedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClosedDay = {
  id: string;
  date: Date;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NoLunchDay = {
  id: string;
  date: Date;
  recordedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLog = {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  createdAt: Date;
};
