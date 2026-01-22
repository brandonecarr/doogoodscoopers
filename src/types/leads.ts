// Lead status for tracking lead progress
// This mirrors the Prisma enum to avoid dependency on generated client
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";

// Lead source to track where leads come from
export type LeadSource = "QUOTE_FORM" | "OUT_OF_AREA" | "CAREERS" | "COMMERCIAL";

// Base interface for common fields
interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: LeadStatus;
  notes: string | null;
}

// Quote Lead model
export interface QuoteLead extends BaseModel {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  zipCode: string;
  numberOfDogs: string | null;
  frequency: string | null;
  lastCleaned: string | null;
  gateLocation: string | null;
  gateCode: string | null;
  lastStep: string | null;
  dogsInfo: unknown;
}

// Out of Area Lead model
export interface OutOfAreaLead extends BaseModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zipCode: string;
}

// Career Application model
export interface CareerApplication extends BaseModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  dateOfBirth: string | null;
  driversLicense: string | null;
  ssnLast4: string | null;
  legalCitizen: boolean;
  hasAutoInsurance: boolean;
  convictedFelony: boolean;
  references: string | null;
  currentEmployment: string | null;
  workDuties: string | null;
  whyLeftPrevious: string | null;
  mayContactEmployers: boolean;
  previousBossContact: string | null;
  whyWorkHere: string | null;
}

// Commercial Lead model
export interface CommercialLead extends BaseModel {
  contactName: string;
  propertyName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zipCode: string;
  inquiry: string | null;
}
