export type Log = {
  id: string;
  user: {
    name: string;
    initials: string;
  };
  action: string;
  timestamp: string;
  status: 'Success' | 'Failure' | 'In Progress';
};

export const logs: Log[] = [
  {
    id: 'LOG-001',
    user: { name: 'Ishanika', initials: 'IK' },
    action: 'Created new job JOB-006',
    timestamp: '2 mins ago',
    status: 'Success',
  },
  {
    id: 'LOG-002',
    user: { name: 'John Doe', initials: 'JD' },
    action: 'Updated user roles for Jane Smith from Collaborator to Manager.',
    timestamp: '1 hour ago',
    status: 'Success',
  },
  {
    id: 'LOG-003',
    user: { name: 'Jane Smith', initials: 'JS' },
    action: 'Failed to create new job: Missing required fields.',
    timestamp: '3 hours ago',
    status: 'Failure',
  },
  {
    id: 'LOG-004',
    user: { name: 'Peter Jones', initials: 'PJ' },
    action: 'Processing menu extraction for JOB-002',
    timestamp: '1 day ago',
    status: 'In Progress',
  },
    {
    id: 'LOG-005',
    user: { name: 'Sarah Lee', initials: 'SL' },
    action: 'Archived job JOB-003',
    timestamp: '2 days ago',
    status: 'Success',
  },
  {
    id: 'LOG-006',
    user: { name: 'Ishanika', initials: 'IK' },
    action: 'Added Tom Brown as a collaborator to job JOB-001.',
    timestamp: '2 days ago',
    status: 'Success',
  },
  {
    id: 'LOG-007',
    user: { name: 'Tom Brown', initials: 'TB' },
    action: 'Uploaded new menu PDF for JOB-001.',
    timestamp: '2 days ago',
    status: 'Success',
  },
  {
    id: 'LOG-008',
    user: { name: 'Ishanika', initials: 'IK' },
    action: 'Changed role for Peter Jones from Pending to Collaborator.',
    timestamp: '3 days ago',
    status: 'Success',
  },
];
