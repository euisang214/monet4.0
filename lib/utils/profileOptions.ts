/**
 * Profile Dropdown Options
 * 
 * Static options for profile forms and filters.
 */

export const industries = [
    'Investment Banking',
    'Private Equity',
    'Venture Capital',
    'Hedge Fund',
    'Asset Management',
    'Management Consulting',
    'Strategy Consulting',
    'Technology',
    'Healthcare',
    'Real Estate',
    'Law',
    'Accounting',
    'Other',
] as const;

export const experienceLevels = [
    'Analyst',
    'Associate',
    'Senior Associate',
    'Vice President',
    'Director',
    'Managing Director',
    'Partner',
    'Principal',
    'C-Suite',
    'Other',
] as const;

export const interestAreas = [
    'Career Advice',
    'Industry Insights',
    'Resume Review',
    'Interview Prep',
    'Networking',
    'Deal Experience',
    'Technical Skills',
    'Work-Life Balance',
    'Salary Negotiation',
    'Transition Advice',
] as const;

export type Industry = (typeof industries)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type InterestArea = (typeof interestAreas)[number];
