import type { BusinessDetail } from './businessesApi'

export const emptyFormValues = {
  bizId: '',
  businessName: '',
  sourceYear: '',
  foundingYear: '',
  firstAppearance: '',
  appearanceDecade: '',
  endYear: '',
  ifClosed: '',
  broadIndustry: '',
  specificIndustry: '',
  race: '',
  gender: '',
  ownerName: '',
  ownershipType: '',
  ownershipDemographic: '',
  address: '',
  postal: '',
  pointX: '',
  pointY: '',
  oldAddress: '',
  phoneNumber: '',
  website: '',
  socialMedia: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  xUrl: '',
  linkedinUrl: '',
  sourceId: '',
  newspaper: '',
  cityDirectories: '',
  googleModernBusiness: '',
  linkOhInterview: '',
  linkGbhStory: '',
  notes: '',
}

export type FormValues = typeof emptyFormValues

function text(value: string | number | null): string {
  return value === null ? '' : String(value)
}

function flag(value: boolean | null): string {
  return value === null ? '' : value ? 'true' : 'false'
}

export function detailToFormValues(detail: BusinessDetail): FormValues {
  return {
    bizId: detail.bizId,
    businessName: detail.businessName,
    sourceYear: text(detail.sourceYear),
    foundingYear: text(detail.foundingYear),
    firstAppearance: text(detail.firstAppearance),
    appearanceDecade: text(detail.appearanceDecade),
    endYear: text(detail.endYear),
    ifClosed: flag(detail.ifClosed),
    broadIndustry: text(detail.broadIndustry),
    specificIndustry: text(detail.specificIndustry),
    race: text(detail.race),
    gender: text(detail.gender),
    ownerName: text(detail.ownerName),
    ownershipType: text(detail.ownershipType),
    ownershipDemographic: text(detail.ownershipDemographic),
    address: text(detail.address),
    postal: text(detail.postal),
    pointX: text(detail.pointX),
    pointY: text(detail.pointY),
    oldAddress: text(detail.oldAddress),
    phoneNumber: text(detail.phoneNumber),
    website: text(detail.website),
    socialMedia: flag(detail.socialMedia),
    facebookUrl: text(detail.facebookUrl),
    instagramUrl: text(detail.instagramUrl),
    youtubeUrl: text(detail.youtubeUrl),
    xUrl: text(detail.xUrl),
    linkedinUrl: text(detail.linkedinUrl),
    sourceId: text(detail.sourceId),
    newspaper: text(detail.newspaper),
    cityDirectories: flag(detail.cityDirectories),
    googleModernBusiness: flag(detail.googleModernBusiness),
    linkOhInterview: text(detail.linkOhInterview),
    linkGbhStory: text(detail.linkGbhStory),
    notes: text(detail.notes),
  }
}
