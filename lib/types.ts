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

export const ExcuseStatus = {
  NONE: "NONE",
  EXCUSED: "EXCUSED",
  UNEXCUSED: "UNEXCUSED",
} as const;

export type ExcuseStatus =
  (typeof ExcuseStatus)[keyof typeof ExcuseStatus];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export type User = {
  id: string;
  clerkId: string;
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
  excuseStatus: ExcuseStatus;
  excuseId: string | null;
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
  submittedById: string;
  submittedAt: Date;
  autoApproved: boolean;
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
