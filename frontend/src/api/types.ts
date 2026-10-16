export type Role = "student" | "teacher" | "methodist" | "admin" | "sysadmin";

export interface UserBrief {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  group_code: string | null;
}
