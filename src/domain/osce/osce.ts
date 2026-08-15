import { AppError } from "@/shared/errors/app-error";

export type OsceRoleType="LEARNER"|"PATIENT"|"CAREGIVER"|"CLINICIAN"|"EVALUATOR_SYSTEM";
export type OsceSessionState="ACTIVE"|"COMPLETED"|"EXPIRED";
export type OsceTriggerType="MANUAL"|"INTERACTION_COUNT";
export type OsceRole=Readonly<{id:string;type:OsceRoleType;label:string;order:number}>;
export type OsceDisclosure=Readonly<{id:string;order:number;triggerType:OsceTriggerType;triggerValue:number|null;content:string}>;
export type OsceRubricCriterion=Readonly<{id:string;description:string;competency:string;importance:number;critical:boolean;order:number}>;
export type OsceRubric=Readonly<{id:string;ruleVersion:string;criteria:readonly OsceRubricCriterion[]}>;
export type OsceStationVersion=Readonly<{id:string;stationId:string;version:number;code:string;title:string;objectiveIds:readonly string[];durationSeconds:number;roles:readonly OsceRole[];scenario:string;disclosures:readonly OsceDisclosure[];rubric:OsceRubric;status:"DRAFT"|"PUBLISHED"|"RETIRED";provenance:string;createdAt:string;publishedAt:string|null}>;
export type OsceSession=Readonly<{id:string;learnerId:string;stationVersionId:string;state:OsceSessionState;startedAt:string;durationSeconds:number;expiresAt:string;completedAt:string|null}>;
export type OsceInteraction=Readonly<{id:string;sessionId:string;roleId:string;sequence:number;timestamp:string;text:string;disclosureId:string|null}>;
export type OsceAssessmentCriterion=Readonly<{criterionId:string;passed:boolean;justification:string;evidence:string;critical:boolean}>;
export type OsceAssessment=Readonly<{id:string;sessionId:string;ruleVersion:string;result:"SATISFACTORY"|"NEEDS_REMEDIATION";createdAt:string;criteria:readonly OsceAssessmentCriterion[]}>;
export type OsceDebrief=Readonly<{id:string;sessionId:string;strengths:readonly string[];unmetCriteria:readonly string[];criticalErrors:readonly string[];explanations:readonly string[];objectiveIds:readonly string[];correctiveActions:readonly string[];nextPractice:string;createdAt:string}>;
export type OsceRemediationLink=Readonly<{id:string;learnerId:string;sessionId:string;stationVersionId:string;criterionId:string;errorCategory:string;critical:boolean;evidenceRef:string;ruleVersion:string;createdAt:string}>;
export type OsceReplay=Readonly<{session:OsceSession;stationVersionId:string;rubricVersion:string;interactions:readonly OsceInteraction[];disclosures:readonly Readonly<{disclosureId:string;revealedAt:string}>[];assessment:OsceAssessment|null;debrief:OsceDebrief|null;remediationLinks:readonly OsceRemediationLink[]}>;

export class OsceError extends AppError { constructor(code:"OSCE_INVALID"|"OSCE_VERSION_NOT_FOUND"|"OSCE_SESSION_NOT_FOUND"|"OSCE_INVALID_TRANSITION"|"OSCE_DISCLOSURE_FORBIDDEN"|"OSCE_PRIVATE_CONTENT",message:string){super({code,userMessage:"L'opération OSCE est invalide.",internalMessage:message,category:"validation"});this.name="OsceError";} }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const assertUuid=(value:string,field:string)=>{if(!uuid.test(value))throw new OsceError("OSCE_INVALID",`${field} must be a UUID.`);return value;};
export function defineOsceStationVersion(value:OsceStationVersion):OsceStationVersion{
  [value.id,value.stationId,value.rubric.id,...value.objectiveIds,...value.roles.map(x=>x.id),...value.disclosures.map(x=>x.id),...value.rubric.criteria.map(x=>x.id)].forEach((id)=>assertUuid(id,"id"));
  if(!Number.isInteger(value.version)||value.version<1||!Number.isInteger(value.durationSeconds)||value.durationSeconds<1||!value.code.trim()||!value.title.trim()||!value.scenario.trim()||value.roles.length<2||value.rubric.criteria.length===0)throw new OsceError("OSCE_INVALID","Station definition is incomplete.");
  const ordered=(items:readonly {order:number}[])=>items.every((item,index)=>item.order===index+1);
  if(!ordered(value.roles)||!ordered(value.disclosures)||!ordered(value.rubric.criteria)||new Set(value.roles.map(x=>x.type)).size!==value.roles.length)throw new OsceError("OSCE_INVALID","Roles, disclosures and criteria must be uniquely ordered.");
  return Object.freeze({...value,objectiveIds:Object.freeze([...value.objectiveIds]),roles:Object.freeze([...value.roles]),disclosures:Object.freeze([...value.disclosures]),rubric:Object.freeze({...value.rubric,criteria:Object.freeze([...value.rubric.criteria])})});
}
export const effectiveSessionState=(session:OsceSession,now:string):OsceSessionState=>session.state==="ACTIVE"&&Date.parse(now)>=Date.parse(session.expiresAt)?"EXPIRED":session.state;
export function assertSessionActive(session:OsceSession,now:string){if(effectiveSessionState(session,now)!=="ACTIVE")throw new OsceError("OSCE_INVALID_TRANSITION","Session is not active.");}
export const publicStation=(station:OsceStationVersion)=>Object.freeze({id:station.id,stationId:station.stationId,version:station.version,code:station.code,title:station.title,objectiveIds:station.objectiveIds,durationSeconds:station.durationSeconds,roles:station.roles,status:station.status});
