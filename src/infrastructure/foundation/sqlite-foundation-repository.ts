import type {
  FoundationCurriculumRepository,
  FoundationCurriculumSnapshot,
  FoundationLearningRepository,
} from "@/application/foundation/foundation-ports";
import type {
  CurriculumBlock,
  CurriculumUnit,
  CurriculumVersion,
  DiagnosticObservation,
  ExitAssessment,
  FoundationDiagnostic,
  FoundationRecommendation,
  FoundationUnitProgress,
  LearningObjective,
  MasteryEstimate,
  PrerequisiteRule,
} from "@/domain/foundation";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FoundationPersistenceError } from "./foundation-persistence-error";

type CurriculumVersionRow = Readonly<{ curriculum_version_id: string; program_id: string; version: number; status: CurriculumVersion["status"]; effective_from: string; effective_to: string | null; created_at: string; published_at: string | null }>;
type BlockRow = Readonly<{ block_id: string; curriculum_version_id: string; code: string; title: string; position: number; is_required: number }>;
type UnitRow = Readonly<{ unit_id: string; block_id: string; code: string; title: string; description: string; estimated_duration_minutes: number; position: number; status: CurriculumUnit["status"] }>;
type ObjectiveRow = Readonly<{ learning_objective_id: string; unit_id: string; code: string; statement: string; objective_type: string; position: number }>;
type PrerequisiteRow = Readonly<{ prerequisite_rule_id: string; unit_id: string; required_unit_id: string | null; required_objective_id: string | null; minimum_mastery_level: PrerequisiteRule["minimumMasteryLevel"]; created_at: string }>;
type DiagnosticRow = Readonly<{ diagnostic_id: string; learner_id: string; curriculum_version_id: string; status: FoundationDiagnostic["status"]; target_block_ids_json: string; started_at: string; completed_at: string | null; observed_count: number; expected_count: number | null }>;
type ObservationRow = Readonly<{ observation_id: string; diagnostic_id: string; learner_id: string; curriculum_version_id: string; block_id: string; unit_id: string | null; objective_id: string | null; activity_type: string; outcome_json: string; confidence: number | null; duration_ms: number | null; critical_error_category: DiagnosticObservation["criticalErrorCategory"]; evidence_type: DiagnosticObservation["evidenceType"]; evidence_ref_id: string | null; evidence_ref_version: string | null; observed_at: string }>;
type MasteryRow = Readonly<{ mastery_estimate_id: string; learner_id: string; curriculum_version_id: string; block_id: string; unit_id: string | null; objective_id: string | null; level: MasteryEstimate["level"]; confidence: number; calculated_at: string; evidence_observation_ids_json: string; rule_version: string }>;
type RecommendationRow = Readonly<{ recommendation_id: string; learner_id: string; curriculum_version_id: string; block_id: string; unit_id: string | null; decision: FoundationRecommendation["decision"]; justification: string; evidence_observation_ids_json: string; rule_version: string; decided_at: string; supersedes_id: string | null }>;
type ExitRow = Readonly<{ exit_assessment_id: string; learner_id: string; curriculum_version_id: string; unit_id: string; status: ExitAssessment["status"]; started_at: string; completed_at: string | null; observation_ids_json: string; result_json: string | null; critical_error_categories_json: string; pedagogical_decision: ExitAssessment["pedagogicalDecision"]; rule_version: string }>;
type ProgressRow = Readonly<{ unit_progress_id: string; learner_id: string; curriculum_version_id: string; unit_id: string; current_stage: FoundationUnitProgress["currentStage"]; status: FoundationUnitProgress["status"]; started_at: string; updated_at: string; completed_at: string | null }>;

const parseIds = (json: string): readonly string[] => Object.freeze(JSON.parse(json) as string[]);
const transaction = (database: SqliteExecutor, operation: () => void): void => {
  database.run("BEGIN IMMEDIATE");
  try {
    operation();
    database.run("COMMIT");
  } catch (cause) {
    database.run("ROLLBACK");
    throw cause;
  }
};

export class SqliteFoundationRepository implements FoundationCurriculumRepository, FoundationLearningRepository {
  constructor(private readonly database: SqliteExecutor) {}

  async save(snapshot: FoundationCurriculumSnapshot): Promise<void> {
    try {
      transaction(this.database, () => {
        const version = snapshot.version;
        this.database.run("INSERT INTO curriculum_versions(curriculum_version_id,program_id,version,status,effective_from,effective_to,created_at,published_at) VALUES(?,?,?,?,?,?,?,?)", version.id, version.programId, version.version, version.status, version.effectiveFrom, version.effectiveTo, version.createdAt, version.publishedAt);
        for (const block of snapshot.blocks) this.database.run("INSERT INTO curriculum_blocks(block_id,curriculum_version_id,code,title,position,is_required) VALUES(?,?,?,?,?,?)", block.id, block.curriculumVersionId, block.code, block.title, block.position, block.isRequired ? 1 : 0);
        for (const unit of snapshot.units) this.database.run("INSERT INTO curriculum_units(unit_id,block_id,code,title,description,estimated_duration_minutes,position,status) VALUES(?,?,?,?,?,?,?,?)", unit.id, unit.blockId, unit.code, unit.title, unit.description, unit.estimatedDurationMinutes, unit.position, unit.status);
        for (const objective of snapshot.objectives) this.database.run("INSERT INTO learning_objectives(learning_objective_id,unit_id,code,statement,objective_type,position) VALUES(?,?,?,?,?,?)", objective.id, objective.unitId, objective.code, objective.statement, objective.objectiveType, objective.position);
        for (const rule of snapshot.prerequisites) this.database.run("INSERT INTO prerequisite_rules(prerequisite_rule_id,unit_id,required_unit_id,required_objective_id,minimum_mastery_level,created_at) VALUES(?,?,?,?,?,?)", rule.id, rule.unitId, rule.requiredUnitId, rule.requiredObjectiveId, rule.minimumMasteryLevel, rule.createdAt);
      });
    } catch (cause) {
      throw new FoundationPersistenceError("Foundation curriculum transaction failed.", cause, { curriculumVersionId: snapshot.version.id });
    }
  }

  async findVersion(curriculumVersionId: string): Promise<FoundationCurriculumSnapshot | null> {
    const version = this.database.all<CurriculumVersionRow>("SELECT * FROM curriculum_versions WHERE curriculum_version_id=?", curriculumVersionId)[0];
    if (!version) return null;
    const blocks = this.database.all<BlockRow>("SELECT * FROM curriculum_blocks WHERE curriculum_version_id=? ORDER BY position", curriculumVersionId);
    const units = this.database.all<UnitRow>("SELECT u.* FROM curriculum_units u JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE b.curriculum_version_id=? ORDER BY b.position,u.position", curriculumVersionId);
    const objectives = this.database.all<ObjectiveRow>("SELECT o.* FROM learning_objectives o JOIN curriculum_units u ON u.unit_id=o.unit_id JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE b.curriculum_version_id=? ORDER BY b.position,u.position,o.position", curriculumVersionId);
    const prerequisites = this.database.all<PrerequisiteRow>("SELECT p.* FROM prerequisite_rules p JOIN curriculum_units u ON u.unit_id=p.unit_id JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE b.curriculum_version_id=? ORDER BY p.created_at,p.prerequisite_rule_id", curriculumVersionId);
    return Object.freeze({
      version: Object.freeze({ id: version.curriculum_version_id, programId: version.program_id, version: version.version, status: version.status, effectiveFrom: version.effective_from, effectiveTo: version.effective_to, createdAt: version.created_at, publishedAt: version.published_at }),
      blocks: Object.freeze(blocks.map((row): CurriculumBlock => Object.freeze({ id: row.block_id, curriculumVersionId: row.curriculum_version_id, code: row.code, title: row.title, position: row.position, isRequired: row.is_required === 1 }))),
      units: Object.freeze(units.map((row): CurriculumUnit => Object.freeze({ id: row.unit_id, blockId: row.block_id, code: row.code, title: row.title, description: row.description, estimatedDurationMinutes: row.estimated_duration_minutes, position: row.position, status: row.status }))),
      objectives: Object.freeze(objectives.map((row): LearningObjective => Object.freeze({ id: row.learning_objective_id, unitId: row.unit_id, code: row.code, statement: row.statement, objectiveType: row.objective_type, position: row.position }))),
      prerequisites: Object.freeze(prerequisites.map((row): PrerequisiteRule => Object.freeze({ id: row.prerequisite_rule_id, unitId: row.unit_id, requiredUnitId: row.required_unit_id, requiredObjectiveId: row.required_objective_id, minimumMasteryLevel: row.minimum_mastery_level, createdAt: row.created_at }))),
    });
  }

  async saveDiagnostic(diagnostic: FoundationDiagnostic): Promise<void> {
    try {
      transaction(this.database, () => {
        const existing = this.database.all<DiagnosticRow>("SELECT * FROM foundation_diagnostics WHERE diagnostic_id=?", diagnostic.id)[0];
        if (!existing) {
          this.database.run("INSERT INTO foundation_diagnostics(diagnostic_id,learner_id,curriculum_version_id,status,target_block_ids_json,started_at,completed_at,observed_count,expected_count) VALUES(?,?,?,?,?,?,?,?,?)", diagnostic.id, diagnostic.learnerId, diagnostic.curriculumVersionId, diagnostic.status, JSON.stringify(diagnostic.targetBlockIds), diagnostic.startedAt, diagnostic.completedAt, diagnostic.observedCount, diagnostic.expectedCount);
        } else if (existing.status !== "IN_PROGRESS" && (existing.status !== diagnostic.status || existing.observed_count !== diagnostic.observedCount)) {
          throw new FoundationPersistenceError("Closed diagnostic is immutable.", undefined, { diagnosticId: diagnostic.id });
        }
        const persistedIds = new Set(this.database.all<{ observation_id: string }>("SELECT observation_id FROM diagnostic_observations WHERE diagnostic_id=?", diagnostic.id).map(({ observation_id }) => observation_id));
        for (const observation of diagnostic.observations) {
          if (!persistedIds.has(observation.id)) this.insertObservation(observation);
        }
        if (existing) this.database.run("UPDATE foundation_diagnostics SET status=?,completed_at=?,observed_count=? WHERE diagnostic_id=? AND status='IN_PROGRESS' AND observed_count<=?", diagnostic.status, diagnostic.completedAt, diagnostic.observedCount, diagnostic.id, diagnostic.observedCount);
      });
    } catch (cause) {
      if (cause instanceof FoundationPersistenceError) throw cause;
      throw new FoundationPersistenceError("Foundation diagnostic transaction failed.", cause, { diagnosticId: diagnostic.id });
    }
  }

  private insertObservation(observation: DiagnosticObservation): void {
    this.database.run("INSERT INTO diagnostic_observations(observation_id,diagnostic_id,learner_id,curriculum_version_id,block_id,unit_id,objective_id,activity_type,outcome_json,confidence,duration_ms,critical_error_category,evidence_type,evidence_ref_id,evidence_ref_version,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", observation.id, observation.diagnosticId, observation.learnerId, observation.curriculumVersionId, observation.blockId, observation.unitId, observation.objectiveId, observation.activityType, JSON.stringify(observation.outcome), observation.confidence, observation.durationMs, observation.criticalErrorCategory, observation.evidenceType, observation.evidenceRefId, observation.evidenceRefVersion, observation.observedAt);
  }

  async findDiagnostic(diagnosticId: string): Promise<FoundationDiagnostic | null> {
    const row = this.database.all<DiagnosticRow>("SELECT * FROM foundation_diagnostics WHERE diagnostic_id=?", diagnosticId)[0];
    if (!row) return null;
    const observations = this.database.all<ObservationRow>("SELECT * FROM diagnostic_observations WHERE diagnostic_id=? ORDER BY observed_at,observation_id", diagnosticId).map((item): DiagnosticObservation => Object.freeze({ id: item.observation_id, diagnosticId: item.diagnostic_id, learnerId: item.learner_id, curriculumVersionId: item.curriculum_version_id, blockId: item.block_id, unitId: item.unit_id, objectiveId: item.objective_id, activityType: item.activity_type, outcome: Object.freeze(JSON.parse(item.outcome_json) as Record<string, unknown>), confidence: item.confidence, durationMs: item.duration_ms, criticalErrorCategory: item.critical_error_category, evidenceType: item.evidence_type, evidenceRefId: item.evidence_ref_id, evidenceRefVersion: item.evidence_ref_version, observedAt: item.observed_at }));
    return Object.freeze({ id: row.diagnostic_id, learnerId: row.learner_id, curriculumVersionId: row.curriculum_version_id, status: row.status, targetBlockIds: parseIds(row.target_block_ids_json), startedAt: row.started_at, completedAt: row.completed_at, observedCount: row.observed_count, expectedCount: row.expected_count, observations: Object.freeze(observations) });
  }

  async appendMasteryEstimate(estimate: MasteryEstimate): Promise<void> {
    try { this.database.run("INSERT INTO mastery_estimates(mastery_estimate_id,learner_id,curriculum_version_id,block_id,unit_id,objective_id,level,confidence,calculated_at,evidence_observation_ids_json,rule_version) VALUES(?,?,?,?,?,?,?,?,?,?,?)", estimate.id, estimate.learnerId, estimate.curriculumVersionId, estimate.blockId, estimate.unitId, estimate.objectiveId, estimate.level, estimate.confidence, estimate.calculatedAt, JSON.stringify(estimate.evidenceObservationIds), estimate.ruleVersion); }
    catch (cause) { throw new FoundationPersistenceError("Mastery estimate append failed.", cause, { masteryEstimateId: estimate.id }); }
  }

  async listMasteryEstimates(learnerId: string): Promise<readonly MasteryEstimate[]> {
    return Object.freeze(this.database.all<MasteryRow>("SELECT * FROM mastery_estimates WHERE learner_id=? ORDER BY calculated_at,mastery_estimate_id", learnerId).map((row): MasteryEstimate => Object.freeze({ id: row.mastery_estimate_id, learnerId: row.learner_id, curriculumVersionId: row.curriculum_version_id, blockId: row.block_id, unitId: row.unit_id, objectiveId: row.objective_id, level: row.level, confidence: row.confidence, calculatedAt: row.calculated_at, evidenceObservationIds: parseIds(row.evidence_observation_ids_json), ruleVersion: row.rule_version })));
  }

  async appendRecommendation(recommendation: FoundationRecommendation): Promise<void> {
    try { this.database.run("INSERT INTO foundation_recommendations(recommendation_id,learner_id,curriculum_version_id,block_id,unit_id,decision,justification,evidence_observation_ids_json,rule_version,decided_at,supersedes_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)", recommendation.id, recommendation.learnerId, recommendation.curriculumVersionId, recommendation.blockId, recommendation.unitId, recommendation.decision, recommendation.justification, JSON.stringify(recommendation.evidenceObservationIds), recommendation.ruleVersion, recommendation.decidedAt, recommendation.supersedesId); }
    catch (cause) { throw new FoundationPersistenceError("Foundation recommendation append failed.", cause, { recommendationId: recommendation.id }); }
  }

  async listRecommendations(learnerId: string): Promise<readonly FoundationRecommendation[]> {
    return Object.freeze(this.database.all<RecommendationRow>("SELECT * FROM foundation_recommendations WHERE learner_id=? ORDER BY decided_at,recommendation_id", learnerId).map((row): FoundationRecommendation => Object.freeze({ id: row.recommendation_id, learnerId: row.learner_id, curriculumVersionId: row.curriculum_version_id, blockId: row.block_id, unitId: row.unit_id, decision: row.decision, justification: row.justification, evidenceObservationIds: parseIds(row.evidence_observation_ids_json), ruleVersion: row.rule_version, decidedAt: row.decided_at, supersedesId: row.supersedes_id })));
  }

  async saveExitAssessment(assessment: ExitAssessment): Promise<void> {
    try {
      const existing = this.database.all<ExitRow>("SELECT * FROM exit_assessments WHERE exit_assessment_id=?", assessment.id)[0];
      if (!existing) this.database.run("INSERT INTO exit_assessments(exit_assessment_id,learner_id,curriculum_version_id,unit_id,status,started_at,completed_at,observation_ids_json,result_json,critical_error_categories_json,pedagogical_decision,rule_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", assessment.id, assessment.learnerId, assessment.curriculumVersionId, assessment.unitId, assessment.status, assessment.startedAt, assessment.completedAt, JSON.stringify(assessment.observationIds), assessment.result ? JSON.stringify(assessment.result) : null, JSON.stringify(assessment.criticalErrorCategories), assessment.pedagogicalDecision, assessment.ruleVersion);
      else if (existing.status === "IN_PROGRESS" && assessment.status === "COMPLETED") this.database.run("UPDATE exit_assessments SET status=?,completed_at=?,observation_ids_json=?,result_json=?,critical_error_categories_json=?,pedagogical_decision=? WHERE exit_assessment_id=? AND status='IN_PROGRESS'", assessment.status, assessment.completedAt, JSON.stringify(assessment.observationIds), JSON.stringify(assessment.result), JSON.stringify(assessment.criticalErrorCategories), assessment.pedagogicalDecision, assessment.id);
      else if (existing.status !== assessment.status) throw new FoundationPersistenceError("Exit assessment transition is invalid.");
    } catch (cause) {
      if (cause instanceof FoundationPersistenceError) throw cause;
      throw new FoundationPersistenceError("Exit assessment save failed.", cause, { exitAssessmentId: assessment.id });
    }
  }

  async findExitAssessment(id: string): Promise<ExitAssessment | null> {
    const row = this.database.all<ExitRow>("SELECT * FROM exit_assessments WHERE exit_assessment_id=?", id)[0];
    return row ? Object.freeze({ id: row.exit_assessment_id, learnerId: row.learner_id, curriculumVersionId: row.curriculum_version_id, unitId: row.unit_id, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, observationIds: parseIds(row.observation_ids_json), result: row.result_json ? Object.freeze(JSON.parse(row.result_json) as Record<string, unknown>) : null, criticalErrorCategories: Object.freeze(JSON.parse(row.critical_error_categories_json) as ExitAssessment["criticalErrorCategories"]), pedagogicalDecision: row.pedagogical_decision, ruleVersion: row.rule_version }) : null;
  }

  async saveUnitProgress(progress: FoundationUnitProgress): Promise<void> {
    try {
      const existing = this.database.all<ProgressRow>("SELECT * FROM foundation_unit_progress WHERE unit_progress_id=?", progress.id)[0];
      if (!existing) this.database.run("INSERT INTO foundation_unit_progress(unit_progress_id,learner_id,curriculum_version_id,unit_id,current_stage,status,started_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?)", progress.id, progress.learnerId, progress.curriculumVersionId, progress.unitId, progress.currentStage, progress.status, progress.startedAt, progress.updatedAt, progress.completedAt);
      else if (existing.status === "IN_PROGRESS") this.database.run("UPDATE foundation_unit_progress SET current_stage=?,status=?,updated_at=?,completed_at=? WHERE unit_progress_id=? AND status='IN_PROGRESS'", progress.currentStage, progress.status, progress.updatedAt, progress.completedAt, progress.id);
      else if (existing.status !== progress.status || existing.current_stage !== progress.currentStage) throw new FoundationPersistenceError("Completed unit progress is immutable.");
    } catch (cause) {
      if (cause instanceof FoundationPersistenceError) throw cause;
      throw new FoundationPersistenceError("Unit progress save failed.", cause, { unitProgressId: progress.id });
    }
  }

  async findUnitProgress(id: string): Promise<FoundationUnitProgress | null> {
    const row = this.database.all<ProgressRow>("SELECT * FROM foundation_unit_progress WHERE unit_progress_id=?", id)[0];
    return row ? Object.freeze({ id: row.unit_progress_id, learnerId: row.learner_id, curriculumVersionId: row.curriculum_version_id, unitId: row.unit_id, currentStage: row.current_stage, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at }) : null;
  }
}
