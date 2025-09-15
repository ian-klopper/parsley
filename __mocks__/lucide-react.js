import React from 'react';

const createLucideIcon = (name) => (props) => <svg data-testid={`${name}-icon`} {...props} />;

export const ArrowLeft = createLucideIcon('ArrowLeft');
export const PlusCircle = createLucideIcon('PlusCircle');
export const LogOut = createLucideIcon('LogOut');
export const UserCog = createLucideIcon('UserCog');
export const FileText = createLucideIcon('FileText');
export const Sun = createLucideIcon('Sun');
export const Moon = createLucideIcon('Moon');
export const AlertCircle = createLucideIcon('AlertCircle');
export const CheckCircle2 = createLucideIcon('CheckCircle2');
