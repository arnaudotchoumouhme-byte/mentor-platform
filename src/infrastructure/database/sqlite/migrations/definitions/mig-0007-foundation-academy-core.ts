import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const FOUNDATION_CORE_TABLE_NAMES = [
  "curriculum_blocks",
  "curriculum_units",
  "curriculum_versions",
  "diagnostic_observations",
  "exit_assessments",
  "foundation_diagnostics",
  "foundation_recommendations",
  "foundation_unit_progress",
  "learning_objectives",
  "mastery_estimates",
  "prerequisite_rules",
] as const;

export const FOUNDATION_CORE_STATEMENTS = [
  `CREATE TABLE curriculum_versions (
    curriculum_version_id TEXT PRIMARY KEY,
    program_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK(version >= 1),
    status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','RETIRED')),
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    created_at TEXT NOT NULL,
    published_at TEXT,
    UNIQUE(program_id,version),
    CHECK(effective_to IS NULL OR effective_to > effective_from),
    CHECK((status='DRAFT' AND published_at IS NULL) OR (status IN ('PUBLISHED','RETIRED') AND published_at IS NOT NULL))
  )`,
  "CREATE INDEX curriculum_versions_program_status ON curriculum_versions(program_id,status,effective_from)",
  `CREATE TABLE curriculum_blocks (
    block_id TEXT PRIMARY KEY,
    curriculum_version_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position >= 0),
    is_required INTEGER NOT NULL CHECK(is_required IN (0,1)),
    UNIQUE(curriculum_version_id,code),
    UNIQUE(curriculum_version_id,position),
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE curriculum_units (
    unit_id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL CHECK(estimated_duration_minutes > 0),
    position INTEGER NOT NULL CHECK(position >= 0),
    status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
    UNIQUE(block_id,code),
    UNIQUE(block_id,position),
    FOREIGN KEY(block_id) REFERENCES curriculum_blocks(block_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX curriculum_units_block_status ON curriculum_units(block_id,status,position)",
  `CREATE TABLE learning_objectives (
    learning_objective_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    code TEXT NOT NULL,
    statement TEXT NOT NULL,
    objective_type TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position >= 0),
    UNIQUE(unit_id,code),
    UNIQUE(unit_id,position),
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE prerequisite_rules (
    prerequisite_rule_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    required_unit_id TEXT,
    required_objective_id TEXT,
    minimum_mastery_level TEXT CHECK(minimum_mastery_level IS NULL OR minimum_mastery_level IN ('N0','N1','N2','N3','N4')),
    created_at TEXT NOT NULL,
    CHECK((required_unit_id IS NOT NULL) <> (required_objective_id IS NOT NULL)),
    CHECK(required_unit_id IS NULL OR required_unit_id <> unit_id),
    UNIQUE(unit_id,required_unit_id,required_objective_id,minimum_mastery_level),
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(required_unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(required_objective_id) REFERENCES learning_objectives(learning_objective_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX prerequisite_rules_unit ON prerequisite_rules(unit_id)",
  "CREATE UNIQUE INDEX prerequisite_rules_required_unit ON prerequisite_rules(unit_id,required_unit_id,IFNULL(minimum_mastery_level,'')) WHERE required_unit_id IS NOT NULL",
  "CREATE UNIQUE INDEX prerequisite_rules_required_objective ON prerequisite_rules(unit_id,required_objective_id,IFNULL(minimum_mastery_level,'')) WHERE required_objective_id IS NOT NULL",
  `CREATE TABLE foundation_diagnostics (
    diagnostic_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('IN_PROGRESS','COMPLETED','CANCELLED')),
    target_block_ids_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    observed_count INTEGER NOT NULL CHECK(observed_count >= 0),
    expected_count INTEGER CHECK(expected_count IS NULL OR expected_count >= 1),
    CHECK((status='IN_PROGRESS' AND completed_at IS NULL) OR (status IN ('COMPLETED','CANCELLED') AND completed_at IS NOT NULL)),
    CHECK(expected_count IS NULL OR observed_count <= expected_count),
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX foundation_diagnostics_learner_status ON foundation_diagnostics(learner_id,status,started_at)",
  "CREATE INDEX foundation_diagnostics_curriculum ON foundation_diagnostics(curriculum_version_id)",
  `CREATE TABLE diagnostic_observations (
    observation_id TEXT PRIMARY KEY,
    diagnostic_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    unit_id TEXT,
    objective_id TEXT,
    activity_type TEXT NOT NULL,
    outcome_json TEXT NOT NULL,
    confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms >= 0),
    critical_error_category TEXT CHECK(critical_error_category IS NULL OR critical_error_category IN ('SAFETY','CALCULATION','PHARMACOTHERAPY','CANADIAN_PRACTICE')),
    evidence_type TEXT NOT NULL CHECK(evidence_type IN ('FOUNDATION','MCQ','COACH','SOURCE_VERSION','EXTERNAL')),
    evidence_ref_id TEXT,
    evidence_ref_version TEXT,
    observed_at TEXT NOT NULL,
    CHECK((evidence_ref_id IS NULL) = (evidence_ref_version IS NULL)),
    FOREIGN KEY(diagnostic_id) REFERENCES foundation_diagnostics(diagnostic_id) ON DELETE RESTRICT,
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(block_id) REFERENCES curriculum_blocks(block_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(objective_id) REFERENCES learning_objectives(learning_objective_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX diagnostic_observations_diagnostic ON diagnostic_observations(diagnostic_id,observed_at)",
  "CREATE INDEX diagnostic_observations_objective ON diagnostic_observations(learner_id,objective_id,observed_at)",
  "CREATE INDEX diagnostic_observations_critical ON diagnostic_observations(learner_id,critical_error_category,observed_at)",
  `CREATE TABLE mastery_estimates (
    mastery_estimate_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    unit_id TEXT,
    objective_id TEXT,
    level TEXT NOT NULL CHECK(level IN ('N0','N1','N2','N3','N4')),
    confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
    calculated_at TEXT NOT NULL,
    evidence_observation_ids_json TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(block_id) REFERENCES curriculum_blocks(block_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(objective_id) REFERENCES learning_objectives(learning_objective_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX mastery_estimates_latest ON mastery_estimates(learner_id,curriculum_version_id,block_id,unit_id,objective_id,calculated_at)",
  `CREATE TABLE foundation_recommendations (
    recommendation_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    unit_id TEXT,
    decision TEXT NOT NULL CHECK(decision IN ('REQUIRED','RECOMMENDED','EXEMPTED')),
    justification TEXT NOT NULL,
    evidence_observation_ids_json TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    supersedes_id TEXT,
    CHECK(supersedes_id IS NULL OR supersedes_id <> recommendation_id),
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(block_id) REFERENCES curriculum_blocks(block_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(supersedes_id) REFERENCES foundation_recommendations(recommendation_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX foundation_recommendations_learner ON foundation_recommendations(learner_id,curriculum_version_id,decided_at)",
  `CREATE TABLE exit_assessments (
    exit_assessment_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('IN_PROGRESS','COMPLETED')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    observation_ids_json TEXT NOT NULL,
    result_json TEXT,
    critical_error_categories_json TEXT NOT NULL,
    pedagogical_decision TEXT CHECK(pedagogical_decision IS NULL OR pedagogical_decision IN ('CONTINUE_FOUNDATION','READY_FOR_MCQ','READY_FOR_TRANSFER','RETEST_REQUIRED')),
    rule_version TEXT NOT NULL,
    CHECK((status='IN_PROGRESS' AND completed_at IS NULL AND result_json IS NULL AND pedagogical_decision IS NULL) OR (status='COMPLETED' AND completed_at IS NOT NULL AND result_json IS NOT NULL AND pedagogical_decision IS NOT NULL)),
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX exit_assessments_learner_unit ON exit_assessments(learner_id,unit_id,started_at)",
  `CREATE TABLE foundation_unit_progress (
    unit_progress_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    curriculum_version_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    current_stage TEXT NOT NULL CHECK(current_stage IN ('PRE_TEST','MICRO_LESSON','GUIDED_PRACTICE','APPLICATION','TEACH_BACK','EXIT_ASSESSMENT','CONSOLIDATION','RETEST')),
    status TEXT NOT NULL CHECK(status IN ('IN_PROGRESS','COMPLETED')),
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK((status='IN_PROGRESS' AND completed_at IS NULL) OR (status='COMPLETED' AND completed_at IS NOT NULL)),
    FOREIGN KEY(curriculum_version_id) REFERENCES curriculum_versions(curriculum_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT
  )`,
  "CREATE UNIQUE INDEX foundation_unit_progress_active ON foundation_unit_progress(learner_id,curriculum_version_id,unit_id) WHERE status='IN_PROGRESS'",
  "CREATE INDEX foundation_unit_progress_resume ON foundation_unit_progress(learner_id,status,updated_at)",
] as const;

export function assertFoundationCoreSchema(database: SqliteExecutor): void {
  const tables = new SqliteSchemaInspector(database).inspect().tables;
  const byName = new Map(tables.map((table) => [table.name, table]));
  if (FOUNDATION_CORE_TABLE_NAMES.some((name) => !byName.has(name))) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Foundation Academy schema is incomplete.");
  }
  const expectedForeignKeys: Readonly<Record<string, readonly string[]>> = {
    curriculum_blocks: ["curriculum_versions"],
    curriculum_units: ["curriculum_blocks"],
    learning_objectives: ["curriculum_units"],
    prerequisite_rules: ["curriculum_units", "learning_objectives"],
    foundation_diagnostics: ["curriculum_versions"],
    diagnostic_observations: ["foundation_diagnostics", "curriculum_versions", "curriculum_blocks", "curriculum_units", "learning_objectives"],
    mastery_estimates: ["curriculum_versions", "curriculum_blocks", "curriculum_units", "learning_objectives"],
    foundation_recommendations: ["curriculum_versions", "curriculum_blocks", "curriculum_units", "foundation_recommendations"],
    exit_assessments: ["curriculum_versions", "curriculum_units"],
    foundation_unit_progress: ["curriculum_versions", "curriculum_units"],
  };
  for (const [tableName, targets] of Object.entries(expectedForeignKeys)) {
    const actual = new Set(byName.get(tableName)?.foreignKeys.map(({ targetTable }) => targetTable));
    if (targets.some((target) => !actual.has(target))) {
      throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", `Foundation table ${tableName} has incomplete foreign keys.`);
    }
  }
  const progress = byName.get("foundation_unit_progress");
  const versions = byName.get("curriculum_versions");
  if (!progress?.indexes.some(({ name, unique }) => name === "foundation_unit_progress_active" && unique) ||
      !versions?.indexes.some(({ unique }) => unique)) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Foundation unique indexes are incomplete.");
  }
}

export const foundationAcademyCoreMigration = {
  id: "MIG-0007",
  fromVersion: 6,
  toVersion: 7,
  description: "Create Foundation Academy curriculum, diagnostic and progress schema",
  checksumMaterial: [...FOUNDATION_CORE_STATEMENTS, "postcondition:foundation-academy-core-v1"],
  up: (database: SqliteExecutor): void => {
    for (const statement of FOUNDATION_CORE_STATEMENTS) database.run(statement);
  },
  validate: assertFoundationCoreSchema,
} as const;
