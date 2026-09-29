import { expect, it } from "vitest";
import { canonicalQuoteText, quoteInSource, generatedCourseItems, diagnoseGenerated, courseGenerationInstructions } from "@/application/mcq/course-generation";
const text = "L’efficacité du suivi clinique doit être évaluée chaque semaine.";
function raw(quote: string) { return {questions:[{stem:"Question synthétique",options:["a","b","c","d"],correct:"a",explanation:text,simple:text,analogy:text,mechanism:text,reasoning:text,clue:text,justifications:[text,text,text,text],trap:text,takeaway:text,transfer:text,quote,competency:"1.1"}]}; }
function source(value: string) { return {documentId:0,name:"offline",text:value,sourceVersionId:"00000000-0000-4000-8000-000000000000"}; }
it.each([
  [text,text],
  [text.replaceAll(" "," \n\t  "),text],
  [text.replaceAll(" ","\u00a0"),text.replaceAll(" ","\u202f")],
  [text.normalize("NFD"),text],
  [text,text.replace("’","'")],
  ["Une «ﬁche» avec un suivi‐clinique est “utile”.","Une «fiche» avec un suivi-clinique est \"utile\"."],
  ["Un suivi‑clinique doit être documenté.","Un suivi-clinique doit être documenté."],
])("accepts only equivalent typography %#",(s,q)=>{
  expect(quoteInSource(s,q)).toBe(true);
  expect(diagnoseGenerated(raw(q),source(s)).QUOTE_IN_SOURCE).toBe(true);
  expect(generatedCourseItems(raw(q),source(s))).toHaveLength(1);
});
it.each([
  "Il faut contrôler chaque semaine l’efficacité du suivi clinique.",
  "Une citation inventée parle d’une autre intervention.",
  "L’efficacité du suivi doit être évaluée chaque semaine.",
  "L’efficacité du suivi clinique doit toujours être évaluée chaque semaine.",
  "Un autre texte prescrit un suivi mensuel distinct.",
  "L’efficacité du suivi clinique doit etre évaluée chaque semaine.",
])("rejects paraphrase, invention, omitted or added words %#",q=>{
  expect(quoteInSource(text,q)).toBe(false);
  expect(diagnoseGenerated(raw(q),source(text)).QUOTE_IN_SOURCE).toBe(false);
  expect(()=>generatedCourseItems(raw(q),source(text))).toThrow();
});
it.each([
  ["Dose 10⁻³ mg chaque matin", "Dose 10-3 mg chaque matin"],
  ["Valeur −5 à contrôler", "Valeur -5 à contrôler"],
  ["Dose 1,5 mg par jour", "Dose 15 mg par jour"],
  ["Suivi clinique obligatoire", "Suivi clinique. obligatoire"],
  ["évaluer le risque", "evaluer le risque"],
  [text, ""],
])("does not erase clinical symbols or punctuation %#",(s,q)=>expect(quoteInSource(s,q)).toBe(false));
it("canonicalization is deterministic and idempotent",()=>expect(canonicalQuoteText(canonicalQuoteText(text))).toBe(canonicalQuoteText(text)));
it("explicitly requires verbatim contiguous copying in the real quote field",()=>{
  expect(courseGenerationInstructions).toContain("The quote field MUST be copied verbatim from the input text field (SOURCE_TEXT)");
  expect(courseGenerationInstructions).toContain("Do not paraphrase, summarize or reconstruct");
  expect(courseGenerationInstructions).toContain("short contiguous passage");
});
