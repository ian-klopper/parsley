export type User = {
  name: string;
  initials: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Collaborator';
};

export const users: User[] = [
  {
    name: "Ishanika",
    initials: "IK",
    email: "ishanika@example.com",
    role: "Admin",
  },
  {
    name: "John Doe",
    initials: "JD",
    email: "john.doe@example.com",
    role: "Manager",
  },
  {
    name: "Jane Smith",
    initials: "JS",
    email: "jane.smith@example.com",
    role: "Collaborator",
  },
  {
    name: "Peter Jones",
    initials: "PJ",
    email: "peter.jones@example.com",
    role: "Collaborator",
  },
    {
    name: "Sarah Lee",
    initials: "SL",
    email: "sarah.lee@example.com",
    role: "Collaborator",
  },
  {
    name: "Tom Brown",
    initials: "TB",
    email: "tom.brown@example.com",
    role: "Manager",
  },
];
