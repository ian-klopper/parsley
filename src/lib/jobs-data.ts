export type Job = {
  venue: string;
  id: string;
  status: 'Live' | 'Draft' | 'Archived' | 'Complete' | 'Error' | 'Processing';
  collaborators: {
    name: string;
    initials: string;
    avatarUrl?: string;
  }[];
  createdBy: string;
  lastActivity: string;
};

export const jobs: Job[] = [
  {
    venue: "The Grand Hall",
    id: "JOB-001",
    status: "Live",
    collaborators: [
      { name: "John Doe", initials: "JD" },
      { name: "Jane Smith", initials: "JS" },
      { name: "Peter Jones", initials: "PJ" },
    ],
    createdBy: "Admin",
    lastActivity: "2 hours ago",
  },
  {
    venue: "Starlight Ballroom",
    id: "JOB-002",
    status: "Processing",
    collaborators: [{ name: "Peter Jones", initials: "PJ" }],
    createdBy: "Manager",
    lastActivity: "1 day ago",
  },
  {
    venue: "The Garden",
    id: "JOB-003",
    status: "Archived",
    collaborators: [
      { name: "Sarah Lee", initials: "SL" },
      { name: "Tom Brown", initials: "TB" },
      { name: "Emily White", initials: "EW" },
    ],
    createdBy: "Admin",
    lastActivity: "1 week ago",
  },
    {
    venue: "Oceanview Deck",
    id: "JOB-004",
    status: "Complete",
    collaborators: [
      { name: "Michael Green", initials: "MG" }
    ],
    createdBy: "Admin",
    lastActivity: "3 hours ago",
  },
  {
    venue: "The Penthouse",
    id: "JOB-005",
    status: "Error",
    collaborators: [
        { name: "Jessica Blue", initials: "JB" },
        { name: "David Black", initials: "DB" }
    ],
    createdBy: "Manager",
    lastActivity: "4 days ago",
  },
];
