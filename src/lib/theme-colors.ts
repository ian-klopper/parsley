// Reusable color utilities for consistent theming

export const getActionBadgeStyle = () => {
  return {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))'
  };
};

export const getLoadingSpinnerClass = () => {
  return "animate-spin rounded-full h-8 w-8 border-b-2 border-primary";
};

export const getTableRowHoverClass = () => {
  return "border-b-0 hover:bg-muted/50 cursor-pointer group transition-colors";
};

export const getCardClass = () => {
  return "bg-card border-border";
};

export const getButtonClass = () => {
  return "bg-primary text-primary-foreground hover:bg-primary/90";
};

export const getSecondaryTextClass = () => {
  return "text-muted-foreground";
};