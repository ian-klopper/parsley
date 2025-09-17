'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { getHashColor, getUserColor, getStatusStyle } from "@/lib/theme-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { UserService } from "@/lib/user-service"
import { useToast } from "@/hooks/use-toast"
import { AccessControl } from "@/components/AccessControl"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import { logsTips } from "@/lib/loading-tips"
import { useTheme } from "next-themes"
import { useState, useEffect, useCallback } from "react"
import { ActivityLogWithUser } from "@/types/database";





const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "success":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "default";
  }
}

const getRequestType = (action: string): string => {
  // Determine the database request type based on the action
  switch (action) {
    // INSERT operations
    case 'job.created':
    case 'job.collaborator_added':
    case 'auth.signup':
      return 'INSERT';

    // UPDATE operations
    case 'job.updated':
    case 'job.status_changed':
    case 'job.ownership_transferred':
    case 'user.role_changed':
    case 'User role updated': // Handle legacy/alternative action names
    case 'user role changed':
    case 'role.changed':
    case 'role_changed':
    case 'user.color_changed':
    case 'user.profile_updated':
    case 'user.approved':
      return 'UPDATE';

    // DELETE operations
    case 'job.deleted':
    case 'job.collaborator_removed':
    case 'user.deleted':
    case 'admin.logs_cleared':
      return 'DELETE';

    // AUTH operations
    case 'auth.login':
    case 'auth.logout':
      return 'AUTH';

    // Default for unknown actions
    default:
      return 'QUERY';
  }
};

const getHttpMethod = (action: string): string => {
  // Map actions to their actual HTTP methods
  switch (action) {
    // POST operations (create new resources)
    case 'job.created':
    case 'job.collaborator_added':
    case 'auth.signup':
    case 'auth.login':
      return 'POST';

    // PUT operations (update existing resources)
    case 'job.updated':
    case 'job.status_changed':
    case 'job.ownership_transferred':
    case 'user.role_changed':
    case 'User role updated': // Handle legacy/alternative action names
    case 'user role changed':
    case 'role.changed':
    case 'role_changed':
    case 'user.color_changed':
    case 'user.profile_updated':
    case 'user.approved':
      return 'PUT';

    // DELETE operations (remove resources)
    case 'job.deleted':
    case 'job.collaborator_removed':
    case 'user.deleted':
    case 'admin.logs_cleared':
      return 'DELETE';

    // GET operations (logout is typically GET, auth operations)
    case 'auth.logout':
      return 'GET';

    // Default for unknown actions
    default:
      return 'GET';
  }
};

const getRequestTypeBadgeStyle = (type: string, theme?: string, mounted?: boolean) => {
  const isDark = mounted && theme === 'dark';

  switch(type) {
    case 'INSERT':
      return {
        backgroundColor: isDark ? 'hsl(145, 85%, 35%)' : 'hsl(145, 90%, 85%)',
        color: isDark ? 'white' : 'hsl(145, 90%, 20%)',
        border: 'none'
      };
    case 'UPDATE':
      return {
        backgroundColor: isDark ? 'hsl(202, 85%, 35%)' : 'hsl(202, 90%, 85%)',
        color: isDark ? 'white' : 'hsl(202, 90%, 20%)',
        border: 'none'
      };
    case 'DELETE':
      return {
        backgroundColor: isDark ? 'hsl(348, 85%, 35%)' : 'hsl(348, 90%, 85%)',
        color: isDark ? 'white' : 'hsl(348, 90%, 20%)',
        border: 'none'
      };
    case 'AUTH':
      return {
        backgroundColor: isDark ? 'hsl(280, 85%, 35%)' : 'hsl(280, 90%, 85%)',
        color: isDark ? 'white' : 'hsl(280, 90%, 20%)',
        border: 'none'
      };
    default:
      return {
        backgroundColor: isDark ? 'hsl(0, 0%, 30%)' : 'hsl(0, 0%, 90%)',
        color: isDark ? 'white' : 'black',
        border: 'none'
      };
  }
};

const getActionBadgeStyle = (action: string, theme?: string, mounted?: boolean) => {
  // Generate a consistent hash-based color for each action type
  let hash = 0;
  for (let i = 0; i < action.length; i++) {
    const char = action.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate HSL color with theme-aware saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = mounted && theme === 'dark' ? 85 : 90; // Theme-aware saturation
  const lightness = mounted && theme === 'dark' ? 35 : 70; // Dark theme: dark colors, Light theme: light colors
  const textColor = mounted && theme === 'dark' ? 'white' : 'black';

  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: textColor,
    border: 'none'
  };
}



// Generate engaging natural language descriptions with varied sentence structures
const generateNaturalDescription = (log: ActivityLogWithUser, allUsers: any[] = [], theme?: string, mounted?: boolean) => {
  const details = log.details as any || {};
  const requestType = getRequestType(log.action);
  const httpMethod = getHttpMethod(log.action);

  // Extract origin user
  const originUser = log.users;
  const originName = originUser?.full_name || details.user_name || details.added_by_name || details.removed_by_name || 'System';

  // Format timestamp with relative time for recent logs
  const timestamp = new Date(log.created_at);
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeText = '';
  if (diffMins < 1) timeText = 'just now';
  else if (diffMins < 60) timeText = `${diffMins}m ago`;
  else if (diffHours < 24) timeText = `${diffHours}h ago`;
  else if (diffDays < 7) timeText = `${diffDays}d ago`;
  else timeText = timestamp.toLocaleDateString();

  // Helper function to create user badge
  const createUserBadge = (user: any, name: string, key: string) => {
    const userForColor = user ? {
      full_name: user.full_name || undefined,
      email: user.email || undefined,
      color_index: user.color_index || undefined
    } : null;
    const userColorStyle = getUserColor(userForColor, theme, mounted || false);

    const tooltipContent = user ?
      `User ID: ${user.id || 'Unknown'}\nEmail: ${user.email || 'Unknown'}\nRole: ${user.role || 'Unknown'}\nColor Index: ${user.color_index || 'Auto'}\nJoined: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}` :
      `System User\nAutomated operations\nNo specific user account`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            className="px-2 py-0.5 mx-1 cursor-help"
            style={{
              backgroundColor: userColorStyle.backgroundColor,
              color: userColorStyle.color,
              border: 'none'
            }}
          >
            {name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>User Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create venue/job badge
  const createVenueBadge = (name: string, key: string) => {
    const tooltipContent = `Job/Venue Reference\nName: ${name}\nType: Business venue or project identifier\nUsed for: Organizing and categorizing work activities`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="px-2 py-0.5 mx-1 cursor-help"
          >
            {name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>Venue/Job Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create action badge
  const createActionBadge = (action: string, key: string) => {
    const tooltipContent = `Action Performed\nOperation: ${action}\nOriginal Action: ${log.action}\nDatabase Operation: ${getRequestType(log.action)}\nHashed Color: Generated from "${log.action}"\nDescription: ${log.description || 'System-generated activity description'}`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            className="px-2 py-0.5 mx-1 cursor-help"
            style={getActionBadgeStyle(log.action, theme, mounted || false)}
          >
            {action}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>Action Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create time badge
  const createTimeBadge = (time: string, key: string) => {
    const tooltipContent = `Timestamp Information\nRelative Time: ${time}\nAbsolute Time: ${timestamp.toLocaleString()}\nISO Format: ${timestamp.toISOString()}\nTime Ago: ${diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins} minutes ago` : diffHours < 24 ? `${diffHours} hours ago` : `${diffDays} days ago`}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="px-2 py-0.5 mx-1 font-mono text-xs cursor-help"
          >
            {time}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>Timestamp Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create status badge
  const createStatusBadge = (status: string, key: string) => {
    const statusEmoji = log.status === 'success' ? '✅' :
                       log.status === 'failure' ? '❌' :
                       log.status === 'pending' ? '⏳' : '🔄';

    const tooltipContent = `Operation Status\nDisplay Status: ${status}\nActual Status: ${log.status}\nStatus Code: ${statusEmoji}\nVariant: ${getStatusBadgeVariant(log.status)}\nTheme Style: Applied based on ${theme || 'system'} theme\nCompletion: ${log.status === 'success' ? 'Operation completed successfully' : log.status === 'failure' ? 'Operation failed' : log.status === 'pending' ? 'Operation in progress' : 'Unknown state'}`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            className="px-2 py-0.5 mx-1 cursor-help"
            variant={getStatusBadgeVariant(log.status)}
            style={getStatusStyle(log.status, theme, mounted || false)}
          >
            {statusEmoji} {status}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>Status Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create request type badge
  const createRequestBadge = (type: string, key: string) => {
    const tooltipContent = `Database Operation\nRequest Type: ${type}\nHTTP Method: ${type === 'INSERT' ? 'POST' : type === 'UPDATE' ? 'PUT/PATCH' : type === 'DELETE' ? 'DELETE' : type === 'AUTH' ? 'POST/GET' : 'GET'}\nDatabase Action: ${type === 'INSERT' ? 'Create new record' : type === 'UPDATE' ? 'Modify existing record' : type === 'DELETE' ? 'Remove record' : type === 'AUTH' ? 'Authentication operation' : 'Query/Read operation'}\nSQL Operation: ${type === 'INSERT' ? 'INSERT INTO' : type === 'UPDATE' ? 'UPDATE SET' : type === 'DELETE' ? 'DELETE FROM' : type === 'AUTH' ? 'Authentication flow' : 'SELECT FROM'}\nColor Scheme: ${type}-specific themed background`;

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            className="font-mono text-xs px-2 py-0.5 mx-1 cursor-help"
            style={getRequestTypeBadgeStyle(type, theme, mounted || false)}
          >
            {type}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>Request Type Details:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper function to create HTTP method badge
  const createHttpMethodBadge = (method: string, key: string) => {
    const tooltipContent = `HTTP Method Details\nHTTP Method: ${method}\nPurpose: ${method === 'POST' ? 'Create new resources' : method === 'PUT' ? 'Update existing resources' : method === 'DELETE' ? 'Remove resources' : method === 'GET' ? 'Retrieve or logout operations' : 'HTTP operation'}\nREST API: ${method === 'POST' ? 'POST /api/resource' : method === 'PUT' ? 'PUT /api/resource/id' : method === 'DELETE' ? 'DELETE /api/resource/id' : 'GET /api/resource'}\nIdempotent: ${method === 'GET' || method === 'PUT' || method === 'DELETE' ? 'Yes' : 'No'}\nBody Required: ${method === 'POST' || method === 'PUT' ? 'Yes' : 'No'}\nSafe Operation: ${method === 'GET' ? 'Yes' : 'No'}`;

    const getHttpMethodStyle = (method: string) => {
      const isDark = mounted && theme === 'dark';
      switch(method) {
        case 'POST':
          return {
            backgroundColor: isDark ? 'hsl(120, 85%, 25%)' : 'hsl(120, 90%, 90%)',
            color: isDark ? 'white' : 'hsl(120, 90%, 20%)',
            border: '1px solid ' + (isDark ? 'hsl(120, 85%, 35%)' : 'hsl(120, 90%, 70%)')
          };
        case 'PUT':
          return {
            backgroundColor: isDark ? 'hsl(45, 85%, 25%)' : 'hsl(45, 90%, 90%)',
            color: isDark ? 'white' : 'hsl(45, 90%, 20%)',
            border: '1px solid ' + (isDark ? 'hsl(45, 85%, 35%)' : 'hsl(45, 90%, 70%)')
          };
        case 'DELETE':
          return {
            backgroundColor: isDark ? 'hsl(0, 85%, 25%)' : 'hsl(0, 90%, 90%)',
            color: isDark ? 'white' : 'hsl(0, 90%, 20%)',
            border: '1px solid ' + (isDark ? 'hsl(0, 85%, 35%)' : 'hsl(0, 90%, 70%)')
          };
        case 'GET':
          return {
            backgroundColor: isDark ? 'hsl(210, 85%, 25%)' : 'hsl(210, 90%, 90%)',
            color: isDark ? 'white' : 'hsl(210, 90%, 20%)',
            border: '1px solid ' + (isDark ? 'hsl(210, 85%, 35%)' : 'hsl(210, 90%, 70%)')
          };
        default:
          return {
            backgroundColor: isDark ? 'hsl(0, 0%, 25%)' : 'hsl(0, 0%, 90%)',
            color: isDark ? 'white' : 'black',
            border: '1px solid ' + (isDark ? 'hsl(0, 0%, 35%)' : 'hsl(0, 0%, 70%)')
          };
      }
    };

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Badge
            className="font-mono text-xs px-2 py-0.5 mx-1 cursor-help font-bold"
            style={getHttpMethodStyle(method)}
          >
            {method}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <div className="text-xs">
            <strong>HTTP Method:</strong><br />
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Extract target user info - enhanced to handle more cases
  let targetUser = null;
  let targetName = null;

  if (details.target_user_id) {
    targetUser = allUsers.find(u => u.id === details.target_user_id);
    targetName = targetUser?.full_name || details.target_user_name || targetUser?.email || 'Unknown User';
  } else if (details.target_user_name) {
    targetName = details.target_user_name;
    // Try to find user by name/email in allUsers for better badge display
    targetUser = allUsers.find(u =>
      u.full_name === details.target_user_name ||
      u.email === details.target_user_name
    );
  } else {
    // For role/user actions, try other field names that might contain target info
    const possibleTargetNames = [
      details.user_email,
      details.changed_user,
      details.affected_user,
      details.subject_user
    ].filter(Boolean);

    if (possibleTargetNames.length > 0) {
      targetName = possibleTargetNames[0];
      targetUser = allUsers.find(u =>
        u.full_name === targetName ||
        u.email === targetName
      );
    }
  }

  // Generate varied, engaging descriptions based on action type
  let descriptionParts: (string | JSX.Element)[] = [];

  // Normalize action for better matching
  const normalizedAction = log.action.toLowerCase().replace(/\s+/g, '.');

  switch (log.action) {
    case 'user.role_changed':
    case 'User role updated': // Handle legacy/alternative action names
    case 'user role changed':
    case 'role.changed':
    case 'role_changed':
      // Handle any role change variations
      const oldRole = details.old_role || 'previous role';
      const newRole = details.new_role || 'new role';

      // Create role-specific badges
      const oldRoleBadge = createActionBadge(`from: ${oldRole}`, 'previous_role');
      const newRoleBadge = createActionBadge(`to: ${newRole}`, 'new_role');
      const transitionType = oldRole === 'pending' ? 'approval granted' :
                           newRole === 'admin' ? 'administrative elevation' :
                           newRole === 'user' ? 'standard access' : 'role transition';

      // Add HTTP method badge for role changes
      const roleHttpMethodBadge = createHttpMethodBadge(httpMethod, 'http_method');

      const roleTemplates = [
        ['I am pleased to report that', createUserBadge(targetUser, targetName || 'user', 'target'), 'has undergone', createActionBadge(transitionType, 'transition'), oldRoleBadge, newRoleBadge, 'through a', roleHttpMethodBadge, 'request by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), '. The elevation was', createStatusBadge(log.status === 'success' ? 'magnificently executed' : log.status, 'status'), '.'],
        ['It is my honour to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('officially sanctioned', 'action'), 'a', createActionBadge(transitionType, 'transition'), 'via', roleHttpMethodBadge, 'protocol for', createUserBadge(targetUser, targetName || 'user', 'target'), ', transitioning', oldRoleBadge, newRoleBadge, createTimeBadge(timeText, 'time'), ', accomplished with', createStatusBadge(log.status === 'success' ? 'distinguished propriety' : log.status, 'status'), '.'],
        ['Allow me to convey that', createUserBadge(targetUser, targetName || 'user', 'target'), 'has experienced a', createActionBadge(transitionType, 'transition'), 'through', roleHttpMethodBadge, 'operation, progressing', oldRoleBadge, newRoleBadge, 'under the guidance of', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge(log.status === 'success' ? 'exemplary advancement' : log.status, 'status'), '.']
      ];
      descriptionParts = roleTemplates[Math.floor(Math.random() * roleTemplates.length)];
      break;

    case 'user.color_changed':
      const oldColor = details.old_color || 'previous color';
      const newColor = details.new_color || 'new color';

      // Create color-specific badges
      const oldColorBadge = createActionBadge(`from: ${oldColor}`, 'previous_color');
      const newColorBadge = createActionBadge(`to: ${newColor}`, 'new_color');
      const colorChangeType = createActionBadge('aesthetic customization', 'color_type');

      const colorTemplates = [
        ['It is my honour to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('masterfully orchestrated', 'action'), colorChangeType, 'for', createUserBadge(targetUser, targetName || 'user', 'target'), ', transitioning', oldColorBadge, newColorBadge, createTimeBadge(timeText, 'time'), 'with', createStatusBadge('impeccable artistry', 'status'), '.'],
        ['I am delighted to report that', createUserBadge(targetUser, targetName || 'user', 'target'), 'has undergone a', createActionBadge('distinguished transformation', 'action'), 'in', colorChangeType, ', progressing', oldColorBadge, newColorBadge, 'through the expertise of', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('visual excellence', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoughtfully curated', 'action'), 'a refined', colorChangeType, 'scheme for', createUserBadge(targetUser, targetName || 'user', 'target'), ', evolving', oldColorBadge, newColorBadge, createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('harmonious presentation', 'status'), '.']
      ];
      descriptionParts = colorTemplates[Math.floor(Math.random() * colorTemplates.length)];
      break;

    case 'user.profile_updated':
      const profileTemplates = [
        ['I take great satisfaction in reporting that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('expertly refined', 'action'), createUserBadge(targetUser, targetName || 'user', 'target'), '\'s profile particulars', createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('meticulous precision', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(targetUser, targetName || 'user', 'target'), '\'s profile has received', createActionBadge('distinguished attention', 'action'), 'from', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('exemplary refinement', 'status'), '.'],
        ['I am pleased to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoughtfully enhanced', 'action'), 'the profile details of', createUserBadge(targetUser, targetName || 'user', 'target'), createTimeBadge(timeText, 'time'), ', as is most', createStatusBadge('proper', 'status'), '.']
      ];
      descriptionParts = profileTemplates[Math.floor(Math.random() * profileTemplates.length)];
      break;

    case 'user.approved':
      const approvalTemplates = [
        ['I have the distinct pleasure of announcing that', createUserBadge(targetUser, targetName || 'user', 'target'), 'has been', createActionBadge('graciously welcomed', 'action'), 'into our distinguished establishment by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('unanimous approval', 'status'), '.'],
        ['It is my honour to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('formally endorsed', 'action'), createUserBadge(targetUser, targetName || 'user', 'target'), '\'s membership', createTimeBadge(timeText, 'time'), ', bringing', createStatusBadge('great satisfaction', 'status'), 'to all concerned.'],
        ['Allow me to convey the delightful news that', createUserBadge(targetUser, targetName || 'user', 'target'), 'has received', createActionBadge('official sanction', 'action'), 'from', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', as is most', createStatusBadge('befitting', 'status'), 'their credentials.']
      ];
      descriptionParts = approvalTemplates[Math.floor(Math.random() * approvalTemplates.length)];
      break;

    case 'user.deleted':
      const deleteTemplates = [
        ['I regret to inform you that', createUserBadge(originUser, originName, 'origin'), 'has found it necessary to', createActionBadge('formally dismiss', 'action'), (targetName || 'a user'), 'from our establishment', createTimeBadge(timeText, 'time'), ', as circumstances', createStatusBadge('required', 'status'), '.'],
        ['It is my solemn duty to report that', (targetName || 'a user'), 'has been', createActionBadge('respectfully removed', 'action'), 'from our records by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', in accordance with', createStatusBadge('proper procedure', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('judiciously concluded', 'action'), (targetName || 'a user'), '\'s association with our establishment', createTimeBadge(timeText, 'time'), ', as', createStatusBadge('deemed appropriate', 'status'), '.']
      ];
      descriptionParts = deleteTemplates[Math.floor(Math.random() * deleteTemplates.length)];
      break;

    case 'job.created':
      const jobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const createTemplates = [
        ['I have the distinct pleasure of informing you that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('masterfully orchestrated', 'action'), 'the creation of', createVenueBadge(jobName, 'venue'), ', which came into being', createTimeBadge(timeText, 'time'), 'and achieved', createStatusBadge('successful inception', 'status'), '.'],
        ['It is my honour to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('expertly commissioned', 'action'), 'a new endeavour entitled', createVenueBadge(jobName, 'venue'), createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('exemplary establishment', 'status'), '.'],
        ['Allow me to convey the splendid news that', createVenueBadge(jobName, 'venue'), 'has been', createActionBadge('thoughtfully conceived', 'action'), 'by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', as is most', createStatusBadge('commendable', 'status'), '.']
      ];
      descriptionParts = createTemplates[Math.floor(Math.random() * createTemplates.length)];
      break;

    case 'job.updated':
      const updateJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const updatedFields = details.updated_fields || [];
      const collaboratorChanges = details.collaborator_changes;
      const httpMethodBadge = createHttpMethodBadge(httpMethod, 'http_method');

      // Handle collaborator changes specifically
      if (collaboratorChanges && (collaboratorChanges.added?.length > 0 || collaboratorChanges.removed?.length > 0)) {
        const addedUsers = collaboratorChanges.added || [];
        const removedUsers = collaboratorChanges.removed || [];
        const addedCount = addedUsers.length;
        const removedCount = removedUsers.length;

        let collaboratorBadges: JSX.Element[] = [];
        let mainAction = '';
        let actionDescription = '';

        if (addedCount > 0 && removedCount === 0) {
          // Only additions
          mainAction = 'graciously invited';
          actionDescription = `${addedCount} new collaborator${addedCount > 1 ? 's' : ''}`;
          addedUsers.forEach((user, index) => {
            const userName = user.name || 'Unknown User';
            const userObj = allUsers.find(u => u.id === user.id);
            collaboratorBadges.push(createUserBadge(userObj, userName, `added_${index}`));
          });
          collaboratorBadges.push(createActionBadge(`+${addedCount} collaborator${addedCount > 1 ? 's' : ''}`, 'addition_count'));

        } else if (removedCount > 0 && addedCount === 0) {
          // Only removals
          mainAction = 'respectfully relieved';
          actionDescription = `${removedCount} collaborator${removedCount > 1 ? 's' : ''}`;
          removedUsers.forEach((user, index) => {
            const userName = user.name || 'Unknown User';
            const userObj = allUsers.find(u => u.id === user.id);
            collaboratorBadges.push(createUserBadge(userObj, userName, `removed_${index}`));
          });
          collaboratorBadges.push(createActionBadge(`-${removedCount} collaborator${removedCount > 1 ? 's' : ''}`, 'removal_count'));

        } else {
          // Mixed changes
          mainAction = 'expertly reorganized';
          actionDescription = 'team composition';
          addedUsers.forEach((user, index) => {
            const userName = user.name || 'Unknown User';
            const userObj = allUsers.find(u => u.id === user.id);
            collaboratorBadges.push(createActionBadge(`+${userName}`, `added_${index}`));
          });
          removedUsers.forEach((user, index) => {
            const userName = user.name || 'Unknown User';
            collaboratorBadges.push(createActionBadge(`-${userName}`, `removed_${index}`));
          });
          collaboratorBadges.push(createActionBadge(`${collaboratorChanges.previous_count} → ${collaboratorChanges.new_count} members`, 'team_change'));
        }

        const collaboratorTemplates = [
          ['I have the distinct pleasure of announcing that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge(mainAction, 'action'), actionDescription, 'for', createVenueBadge(updateJobName, 'venue'), 'via', httpMethodBadge, 'request:', ...collaboratorBadges, createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('optimal teamwork', 'status'), '.'],
          ['It is my honour to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge(mainAction, 'action'), actionDescription, 'on', createVenueBadge(updateJobName, 'venue'), 'through', httpMethodBadge, 'protocol:', ...collaboratorBadges, createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('enhanced collaboration', 'status'), '.'],
          ['Allow me to convey that', createVenueBadge(updateJobName, 'venue'), 'has received', createActionBadge('distinguished attention', 'action'), 'from', createUserBadge(originUser, originName, 'origin'), 'via', httpMethodBadge, 'operation,', createActionBadge(mainAction, 'specific'), actionDescription, ':', ...collaboratorBadges, createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('excellent coordination', 'status'), '.']
        ];
        descriptionParts = collaboratorTemplates[Math.floor(Math.random() * collaboratorTemplates.length)];

      } else {
        // Handle other field updates with specific field detection
        let specificActionText = 'modification';
        let additionalBadges: JSX.Element[] = [];
        let mainActionText = 'expertly updated';

        if (updatedFields.includes('venue')) {
          specificActionText = 'venue relocation';
          mainActionText = 'relocated';
          additionalBadges.push(createActionBadge('venue details', 'venue_change'));
        } else if (updatedFields.includes('job_id')) {
          specificActionText = 'identifier revision';
          mainActionText = 'renumbered';
          additionalBadges.push(createActionBadge('job ID', 'id_change'));
        } else if (updatedFields.includes('description')) {
          specificActionText = 'description enhancement';
          mainActionText = 'redescribed';
          additionalBadges.push(createActionBadge('job description', 'description_change'));
        } else if (updatedFields.length > 0) {
          const fieldsList = updatedFields.join(', ');
          specificActionText = `${fieldsList} refinement`;
          mainActionText = 'refined';
          additionalBadges.push(createActionBadge(`modified: ${fieldsList}`, 'fields'));
        } else {
          // No specific fields detected - enhance database description with badges
          const simpleTemplates = [
            ['I am pleased to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('expertly updated', 'action'), createVenueBadge(updateJobName, 'venue'), 'via', httpMethodBadge, 'request', createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('✅ successful completion', 'status'), '.'],
            ['It is my honour to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('skillfully modified', 'action'), createVenueBadge(updateJobName, 'venue'), 'through', httpMethodBadge, 'protocol', createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('✅ optimal outcome', 'status'), '.'],
            ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoughtfully refined', 'action'), createVenueBadge(updateJobName, 'venue'), 'using', httpMethodBadge, 'methodology', createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('✅ precise execution', 'status'), '.']
          ];
          descriptionParts = simpleTemplates[Math.floor(Math.random() * simpleTemplates.length)];
          break;
        }

        const updateTemplates = [
          ['I am pleased to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge(mainActionText, 'action'), createVenueBadge(updateJobName, 'venue'), 'via', httpMethodBadge, 'request, conducting', createActionBadge(specificActionText, 'update_type'), ...additionalBadges, createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('✅ precise refinement', 'status'), '.'],
          ['It is my honour to announce that', createVenueBadge(updateJobName, 'venue'), 'has undergone', createActionBadge('distinguished modifications', 'action'), 'through', httpMethodBadge, 'protocol by', createUserBadge(originUser, originName, 'origin'), ', specifically', createActionBadge(specificActionText, 'update_type'), ...additionalBadges, createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('✅ excellent enhancement', 'status'), '.'],
          ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('expertly orchestrated', 'action'), 'a', httpMethodBadge, 'operation for', createActionBadge(specificActionText, 'update_type'), 'of', createVenueBadge(updateJobName, 'venue'), ...additionalBadges, createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('✅ optimal configuration', 'status'), '.']
        ];
        descriptionParts = updateTemplates[Math.floor(Math.random() * updateTemplates.length)];
      }
      break;

    case 'job.deleted':
      const deletedJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const deleteJobTemplates = [
        ['I regret to inform you that', createUserBadge(originUser, originName, 'origin'), 'has found it necessary to', createActionBadge('permanently retire', 'action'), createVenueBadge(deletedJobName, 'venue'), 'from our distinguished registry', createTimeBadge(timeText, 'time'), ', as circumstances', createStatusBadge('required', 'status'), 'this decisive measure.'],
        ['It is my solemn duty to report that', createVenueBadge(deletedJobName, 'venue'), 'has been', createActionBadge('formally concluded', 'action'), 'and removed from our establishment by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('complete closure', 'status'), 'of this endeavour.'],
        ['Allow me to convey with appropriate gravity that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('judiciously terminated', 'action'), createVenueBadge(deletedJobName, 'venue'), 'and expunged it from our records', createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('definitive resolution', 'status'), 'of all associated matters.']
      ];
      descriptionParts = deleteJobTemplates[Math.floor(Math.random() * deleteJobTemplates.length)];
      break;

    case 'job.status_changed':
      const statusJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const statusChangeTemplates = [
        ['I am pleased to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('judiciously advanced', 'action'), createVenueBadge(statusJobName, 'venue'), 'from', details.old_status || 'previous', 'to', createActionBadge(details.new_status || 'new status', 'status'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('proper progression', 'completion'), '.'],
        ['It is my honour to announce that', createVenueBadge(statusJobName, 'venue'), 'has been', createActionBadge('expertly transitioned', 'action'), 'to', createActionBadge(details.new_status || 'new status', 'status'), 'by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', as is most', createStatusBadge('appropriate', 'completion'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoughtfully progressed', 'action'), createVenueBadge(statusJobName, 'venue'), 'to', createActionBadge(details.new_status || 'new status', 'status'), createTimeBadge(timeText, 'time'), ', demonstrating', createStatusBadge('excellent stewardship', 'completion'), '.']
      ];
      descriptionParts = statusChangeTemplates[Math.floor(Math.random() * statusChangeTemplates.length)];
      break;

    case 'job.ownership_transferred':
      const transferJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const previousOwnerUser = allUsers.find(u => u.full_name === details.previous_owner_name || u.email === details.previous_owner_name);
      const newOwnerUser = allUsers.find(u => u.full_name === details.new_owner_name || u.email === details.new_owner_name);
      const transferTemplates = [
        ['I have the solemn honour of announcing that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('formally transferred', 'action'), 'the distinguished ownership of', createVenueBadge(transferJobName, 'venue'), 'from', createUserBadge(previousOwnerUser, details.previous_owner_name || 'previous owner', 'previous_owner'), 'to', createUserBadge(newOwnerUser, details.new_owner_name || 'new owner', 'new_owner'), createTimeBadge(timeText, 'time'), ', completing this', createStatusBadge('momentous transition', 'status'), 'with utmost propriety.'],
        ['It is my distinguished privilege to report that', createVenueBadge(transferJobName, 'venue'), 'has undergone a', createActionBadge('ceremonial change', 'action'), 'of stewardship, as', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('graciously facilitated', 'action'), 'the passage of ownership from', createUserBadge(previousOwnerUser, details.previous_owner_name || 'previous owner', 'previous_owner'), 'to', createUserBadge(newOwnerUser, details.new_owner_name || 'new owner', 'new_owner'), createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('seamless continuity', 'status'), '.'],
        ['Allow me to convey the momentous news that', createUserBadge(newOwnerUser, details.new_owner_name || 'new owner', 'new_owner'), 'has been', createActionBadge('duly appointed', 'action'), 'as the new proprietor of', createVenueBadge(transferJobName, 'venue'), ', succeeding', createUserBadge(previousOwnerUser, details.previous_owner_name || 'previous owner', 'previous_owner'), 'through the careful orchestration of', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('exemplary succession', 'status'), '.']
      ];
      descriptionParts = transferTemplates[Math.floor(Math.random() * transferTemplates.length)];
      break;

    case 'job.collaborator_added':
      const addJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const addedUser = allUsers.find(u => u.full_name === details.collaborator_name);
      const addTemplates = [
        ['I have the distinct pleasure of announcing that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('graciously extended', 'action'), 'a collaborative invitation to', createUserBadge(addedUser, details.collaborator_name || 'new collaborator', 'new_collaborator'), 'for the esteemed project', createVenueBadge(addJobName, 'venue'), createTimeBadge(timeText, 'time'), ', thereby expanding our', createStatusBadge('distinguished consortium', 'status'), '.'],
        ['It is my honour to report that', createUserBadge(addedUser, details.collaborator_name || 'new collaborator', 'new_collaborator'), 'has been', createActionBadge('formally inducted', 'action'), 'as a collaborator on', createVenueBadge(addJobName, 'venue'), 'through the thoughtful initiative of', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('enhanced teamwork', 'status'), '.'],
        ['Allow me to convey the delightful news that', createVenueBadge(addJobName, 'venue'), 'has been', createActionBadge('strategically reinforced', 'action'), 'with the collaborative addition of', createUserBadge(addedUser, details.collaborator_name || 'new collaborator', 'new_collaborator'), ', orchestrated by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('optimal team composition', 'status'), '.']
      ];
      descriptionParts = addTemplates[Math.floor(Math.random() * addTemplates.length)];
      break;

    case 'job.collaborator_removed':
      const removeJobName = details.job_venue || `Job ${details.job_number}` || 'Unknown Job';
      const removedUser = allUsers.find(u => u.full_name === details.collaborator_name || u.email === details.collaborator_name);
      const removeTemplates = [
        ['I regret to inform you that', createUserBadge(originUser, originName, 'origin'), 'has found it necessary to', createActionBadge('formally dismiss', 'action'), createUserBadge(removedUser, details.collaborator_name || 'collaborator', 'removed_collaborator'), 'from their collaborative duties on', createVenueBadge(removeJobName, 'venue'), createTimeBadge(timeText, 'time'), ', as circumstances', createStatusBadge('required', 'status'), 'this prudent action.'],
        ['It is my solemn duty to report that', createUserBadge(removedUser, details.collaborator_name || 'collaborator', 'removed_collaborator'), 'has been', createActionBadge('respectfully relieved', 'action'), 'of their collaborative responsibilities for', createVenueBadge(removeJobName, 'venue'), 'by', createUserBadge(originUser, originName, 'origin'), createTimeBadge(timeText, 'time'), ', in accordance with', createStatusBadge('proper protocol', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('judiciously concluded', 'action'), createUserBadge(removedUser, details.collaborator_name || 'collaborator', 'removed_collaborator'), '\'s participation in', createVenueBadge(removeJobName, 'venue'), createTimeBadge(timeText, 'time'), ', ensuring the project maintains its', createStatusBadge('optimal composition', 'status'), '.']
      ];
      descriptionParts = removeTemplates[Math.floor(Math.random() * removeTemplates.length)];
      break;

    case 'auth.login':
      const loginTemplates = [
        ['I am delighted to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('gracefully arrived', 'action'), 'and authenticated themselves', createTimeBadge(timeText, 'time'), 'via', createRequestBadge(requestType, 'request'), 'protocol, as is most', createStatusBadge('proper', 'status'), '.'],
        ['It is my pleasure to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('successfully presented', 'action'), 'their credentials', createTimeBadge(timeText, 'time'), ', gaining', createStatusBadge('authorised access', 'status'), 'to our establishment.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('formally entered', 'action'), 'our distinguished premises', createTimeBadge(timeText, 'time'), 'through', createRequestBadge(requestType, 'request'), 'authentication, achieving', createStatusBadge('seamless entry', 'status'), '.']
      ];
      descriptionParts = loginTemplates[Math.floor(Math.random() * loginTemplates.length)];
      break;

    case 'auth.logout':
      const logoutTemplates = [
        ['I regret to inform you that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('gracefully departed', 'action'), 'our establishment', createTimeBadge(timeText, 'time'), ', completing their session with', createStatusBadge('proper decorum', 'status'), '.'],
        ['It is my duty to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('formally concluded', 'action'), 'their visit', createTimeBadge(timeText, 'time'), 'through', createRequestBadge(requestType, 'request'), 'protocol, as is most', createStatusBadge('appropriate', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('respectfully withdrawn', 'action'), 'from our premises', createTimeBadge(timeText, 'time'), ', achieving', createStatusBadge('orderly departure', 'status'), 'in the finest tradition.']
      ];
      descriptionParts = logoutTemplates[Math.floor(Math.random() * logoutTemplates.length)];
      break;

    case 'auth.signup':
      const signupTemplates = [
        ['I have the distinct honour of announcing that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('graciously presented', 'action'), 'themselves for membership in our distinguished establishment', createTimeBadge(timeText, 'time'), ', beginning their', createStatusBadge('promising association', 'status'), '.'],
        ['It is my pleasure to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('formally registered', 'action'), 'with our esteemed institution', createTimeBadge(timeText, 'time'), 'through', createRequestBadge(requestType, 'request'), 'protocol, achieving', createStatusBadge('successful enrollment', 'status'), '.'],
        ['Allow me to convey the delightful news that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoughtfully commenced', 'action'), 'their journey with our organisation', createTimeBadge(timeText, 'time'), ', as is most', createStatusBadge('auspicious', 'status'), '.']
      ];
      descriptionParts = signupTemplates[Math.floor(Math.random() * signupTemplates.length)];
      break;

    case 'admin.logs_cleared':
      const logsClearedTemplates = [
        ['I must dutifully report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('meticulously purged', 'action'), 'all records from our activity ledgers', createTimeBadge(timeText, 'time'), ', maintaining', createStatusBadge('pristine archives', 'status'), 'for our establishment.'],
        ['It is my solemn duty to announce that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('thoroughly cleansed', 'action'), 'the entire activity log repository', createTimeBadge(timeText, 'time'), 'via', createRequestBadge(requestType, 'request'), 'protocol, achieving', createStatusBadge('complete purification', 'status'), '.'],
        ['Allow me to convey that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('judiciously cleared', 'action'), 'all historical records from our distinguished archives', createTimeBadge(timeText, 'time'), ', ensuring', createStatusBadge('immaculate documentation', 'status'), 'standards.']
      ];
      descriptionParts = logsClearedTemplates[Math.floor(Math.random() * logsClearedTemplates.length)];
      break;

    default:
      // Debug: show the actual action value
      console.log('Unhandled action:', log.action, 'Details:', details);

      // Add HTTP method badge for unhandled actions
      const defaultHttpMethodBadge = createHttpMethodBadge(httpMethod, 'http_method');

      // Enhanced error handling for failed operations
      const isFailure = log.status === 'failure';
      const errorLanguage = isFailure ?
        ['I regret to inform you that', createUserBadge(originUser, originName, 'origin'), 'encountered difficulties while executing a', defaultHttpMethodBadge, 'request for', createActionBadge(`"${log.action}"`, 'specific'), 'operation', createTimeBadge(timeText, 'time'), ', resulting in', createStatusBadge('operational challenges', 'status'), 'that require attention.'] :
        ['I am pleased to report that', createUserBadge(originUser, originName, 'origin'), 'has', createActionBadge('performed', 'action'), 'a', defaultHttpMethodBadge, 'request for', createActionBadge(`"${log.action}"`, 'specific'), 'operation', createTimeBadge(timeText, 'time'), 'via', createRequestBadge(requestType, 'request'), 'protocol, as recorded in our', createStatusBadge('official ledgers', 'status'), '.'];

      descriptionParts = errorLanguage;
      break;
  }

  return {
    requestType,
    originUser,
    originName,
    targetUser,
    targetName,
    descriptionParts,
    timestamp: timestamp.toLocaleString(),
    statusText: log.status,
    details
  };
};


export default function LogsPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<ActivityLogWithUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);

    // Load both logs and users
    const [logsResult, usersResult] = await Promise.all([
      UserService.getActivityLogs(),
      UserService.getAllUsers()
    ]);

    if (logsResult.error) {
      toast({
        title: "Error",
        description: "Failed to load logs: " + logsResult.error,
        variant: "destructive",
      });
    } else {
      setLogs(logsResult.data || []);
    }

    if (!usersResult.error) {
      setAllUsers(usersResult.data || []);
    }

    setLoading(false);
  }, [toast]);

  const handleClearLogs = useCallback(async () => {
    if (!confirm('Are you sure you want to clear ALL activity logs? This action cannot be undone.')) {
      return;
    }

    setClearing(true);
    const result = await UserService.clearActivityLogs();

    if (result.error) {
      toast({
        title: "Error",
        description: "Failed to clear logs: " + result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "All activity logs have been cleared successfully",
      });
      // Reload the logs to show the empty state
      await loadLogs();
    }

    setClearing(false);
  }, [toast, loadLogs]);

  useEffect(() => {
    setMounted(true);
    loadLogs();
  }, [loadLogs]);

  return (
    <AccessControl requireRole="admin">
      <PageLayout title="Activity Logs" showBackButton={true}>
        <div className="w-full">
          <div className="mb-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Total logs: {logs.length}
            </div>
            <Button
              onClick={handleClearLogs}
              disabled={clearing || loading || logs.length === 0}
              variant="destructive"
              size="sm"
            >
              {clearing ? 'Clearing...' : 'Clear All Logs'}
            </Button>
          </div>
              {loading ? (
                <LoadingWithTips
                  title="Loading Activity Logs"
                  subtitle="Retrieving system activity and user actions..."
                  tips={logsTips}
                  size="sm"
                  className="py-8"
                />
              ) : (
                <div className="flex justify-center">
                  <div className="w-full max-w-3xl">
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-0">
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log, index) => {
                            const descData = generateNaturalDescription(log, allUsers, theme, mounted);

                            return (
                              <TableRow key={log.id || index} className="border-b-0 hover:bg-muted/50">
                                <TableCell className="py-6 px-6">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {/* Render the complete varied description */}
                                    {descData.descriptionParts.map((part, partIndex) =>
                                      typeof part === 'string' ? (
                                        <span key={`part-${partIndex}`} className="text-sm">{part}</span>
                                      ) : part
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {logs.length === 0 && (
                            <TableRow className="border-b-0">
                              <TableCell colSpan={1} className="text-center py-8 text-muted-foreground">
                                No activity logs found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </div>
                </div>
              )}
        </div>
      </PageLayout>
    </AccessControl>
  );
}
